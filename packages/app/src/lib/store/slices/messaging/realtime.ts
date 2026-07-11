import type { ActivityItem, Channel, DirectMessage, Message, User } from "@slock/slack-api";
import { mapMessage, parseBadgeCounts } from "@slock/slack-api";
import { createEffect, createSignal, onCleanup } from "solid-js";
import type { MessageLocation, ThreadRef, View } from "../types";
import { classifyIncomingActivity } from "./activity";
import { mergeMessages } from "./messages";

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

// A single persistent socket to our own server, which relays Slack's RTM
// websocket (or, if that's unavailable for this workspace, its own fallback
// poll) — the browser itself never polls on an interval.
export function createRealtimeSlice(deps: {
  activeView: () => View | null;
  activeThread: () => ThreadRef | null;
  currentUser: () => User | undefined;
  channels: () => Channel[];
  patchChannel: (id: string, patch: Partial<Channel>) => void;
  setUnreadChannelIds: (id: string, unread: boolean) => void;
  setPresenceOverrides: (id: string, presence: "active" | "away") => void;
  invalidateUser: (id: string) => void;
  recordTyping: (channelId: string, threadTs: string | undefined, userId: string) => void;
  allDirectMessages: () => DirectMessage[];
  setDmLastActivity: (id: string, ts: number) => void;
  closedDmIds: Record<string, boolean>;
  setClosedDmIds: (id: string, closed: boolean) => void;
  isChannelNotifyAll: (id: string) => boolean;
  pushActivity: (item: ActivityItem) => void;
  messagesByChannel: Record<string, Message[]>;
  setMessagesByChannel: (...args: any[]) => void;
  threadMessages: Record<string, Message[]>;
  setThreadMessages: (...args: any[]) => void;
  loadedChannels: Set<string>;
  loadedThreads: Set<string>;
  findAllMessageLocations: (
    channelId: string,
    ts: string,
  ) => { location: MessageLocation; list: Message[] }[];
  patchMessage: (channelId: string, ts: string, patch: Partial<Message>) => void;
  insertMessageInOrder: (channelId: string, msg: Message) => void;
  mergeIncomingMessage: (existing: Message[], msg: Message) => Message[];
  applyReactionEvent: (
    channel: string,
    ts: string,
    name: string,
    userId: string,
    added: boolean,
  ) => void;
}) {
  const [rtmConnected, setRtmConnected] = createSignal(false);

  let socket: WebSocket | null = null;
  let reconnectDelay = 1000;
  const MAX_RECONNECT_DELAY = 20000;

  function send(payload: unknown) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }

  function handleIncomingMessage(payload: any) {
    const subtype = payload.subtype;
    const channel = payload.channel;

    if (subtype === "message_changed") {
      const updated = payload.message;
      if (!updated?.ts) return;
      // Broadcasting a reply (ours or another member's) goes through
      // chat.update under the hood, same as a text edit, so it arrives here
      // rather than as a fresh "message" event — mirror it into the channel
      // list the same way a live broadcast would.
      const isBroadcast = updated.subtype === "thread_broadcast";
      deps.patchMessage(channel, updated.ts, {
        text: updated.text,
        blocks: updated.blocks,
        edited: !!updated.edited,
        isBroadcast,
      });
      if (isBroadcast && deps.loadedChannels.has(channel)) {
        const msg = deps
          .findAllMessageLocations(channel, updated.ts)[0]
          ?.list.find((m) => m.ts === updated.ts);
        if (msg) deps.insertMessageInOrder(channel, msg);
      }
      return;
    }

    if (subtype === "message_deleted") {
      const ts = payload.deleted_ts;
      if (!ts) return;
      // Slack removes deleted messages outright; we keep the row as a red
      // tombstone instead so the conversation doesn't silently reshuffle.
      deps.patchMessage(channel, ts, { deleted: true });
      return;
    }

    const ts = payload.ts;
    if (!ts) return;
    const msg = mapMessage(payload);

    // Ephemeral messages (e.g. slash command responses) are pushed only to
    // the user they're meant for, never land in real history, and shouldn't
    // affect unread/activity state — just surface them in the channel the
    // user is currently looking at.
    if (msg.isEphemeral) {
      if (deps.loadedChannels.has(channel)) {
        deps.setMessagesByChannel(channel, (existing: Message[] = []) => [...existing, msg]);
      }
      return;
    }

    const me = deps.currentUser();
    const isThreadReply = !!payload.thread_ts && payload.thread_ts !== ts;
    let threadRelevant = false;

    if (isThreadReply) {
      if (deps.loadedThreads.has(payload.thread_ts)) {
        deps.setThreadMessages(payload.thread_ts, (existing: Message[] = []) =>
          deps.mergeIncomingMessage(existing, msg),
        );
      }
      const parentLocations = deps.findAllMessageLocations(channel, payload.thread_ts);
      const parentMsg = parentLocations[0]?.list.find((m) => m.ts === payload.thread_ts);
      if (parentMsg) {
        deps.patchMessage(channel, payload.thread_ts, {
          replyCount: (parentMsg.replyCount ?? 0) + 1,
        });
        if (me && parentMsg.userId === me.id) threadRelevant = true;
      }
      if (
        me &&
        !threadRelevant &&
        deps.threadMessages[payload.thread_ts]?.some((m) => m.userId === me.id)
      )
        threadRelevant = true;
      // A reply sent with "Also send to channel" checked arrives as a
      // regular new "message" event (unlike broadcasting an existing reply
      // after the fact, which is a chat.update / message_changed) — it still
      // belongs in the channel's own timeline alongside the thread.
      if (subtype === "thread_broadcast" && deps.loadedChannels.has(channel)) {
        deps.setMessagesByChannel(channel, (existing: Message[] = []) =>
          deps.mergeIncomingMessage(existing, msg),
        );
      }
    } else if (deps.loadedChannels.has(channel)) {
      deps.setMessagesByChannel(channel, (existing: Message[] = []) =>
        deps.mergeIncomingMessage(existing, msg),
      );
    }

    const activeId = deps.activeView()?.id;
    if (channel !== activeId) deps.setUnreadChannelIds(channel, true);

    if (deps.allDirectMessages().some((d) => d.id === channel)) {
      deps.setDmLastActivity(channel, Date.now());
      // A new message on a DM the user closed means it's active again.
      if (deps.closedDmIds[channel]) deps.setClosedDmIds(channel, false);
    }

    if (me && msg.userId !== me.id) {
      const activity = classifyIncomingActivity(
        channel,
        ts,
        msg,
        me.id,
        threadRelevant,
        isThreadReply ? payload.thread_ts : undefined,
        {
          isDirectMessage: (id) => deps.allDirectMessages().some((d) => d.id === id),
          isNotifyAll: deps.isChannelNotifyAll,
        },
      );
      if (activity) {
        deps.pushActivity(activity);
        if (activity.kind === "mention") {
          const current = deps.channels().find((c) => c.id === channel)?.mentions ?? 0;
          deps.patchChannel(channel, { mentions: current + 1 });
        }
      }
    }
  }

  function connectSocket() {
    socket = new WebSocket(wsUrl());

    socket.addEventListener("open", () => {
      reconnectDelay = 1000;
      for (const channel of deps.loadedChannels) send({ type: "watch_channel", channel });
      const thread = deps.activeThread();
      if (thread) send({ type: "watch_thread", channel: thread.channelId, ts: thread.ts });
    });

    socket.addEventListener("message", (event) => {
      let payload: any;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (payload.type) {
        case "_status":
          setRtmConnected(!!payload.connected);
          break;
        case "_history_snapshot":
          if (deps.loadedChannels.has(payload.channel)) {
            const fresh = (payload.messages ?? [])
              .filter((m: any) => m.type === "message" && !m.subtype)
              .map(mapMessage)
              .reverse();
            deps.setMessagesByChannel(payload.channel, (existing: Message[] = []) =>
              mergeMessages(existing, fresh),
            );
          }
          break;
        case "_replies_snapshot":
          if (deps.loadedThreads.has(payload.ts)) {
            const fresh = (payload.messages ?? [])
              .filter((m: any) => m.type === "message")
              .map(mapMessage);
            deps.setThreadMessages(payload.ts, (existing: Message[] = []) =>
              mergeMessages(existing, fresh),
            );
          }
          break;
        case "message":
          handleIncomingMessage(payload);
          break;
        case "reaction_added":
        case "reaction_removed":
          // Our own reacts/unreacts are already applied optimistically in
          // reactToMessage — the gateway echoes them back over the socket like
          // any other client's, so re-applying here double-counted them.
          if (
            payload.item?.channel &&
            payload.item?.ts &&
            payload.user !== deps.currentUser()?.id
          ) {
            deps.applyReactionEvent(
              payload.item.channel,
              payload.item.ts,
              payload.reaction,
              payload.user,
              payload.type === "reaction_added",
            );
          }
          break;
        case "presence_change": {
          const presence = payload.presence === "away" ? "away" : "active";
          const ids: string[] = payload.users ?? (payload.user ? [payload.user] : []);
          for (const id of ids) deps.setPresenceOverrides(id, presence);
          break;
        }
        case "user_typing": {
          if (payload.channel && payload.user && payload.user !== deps.currentUser()?.id) {
            deps.recordTyping(payload.channel, payload.thread_ts, payload.user);
          }
          break;
        }
        case "badge_counts_updated": {
          for (const [id, { unread, mentions }] of Object.entries(parseBadgeCounts(payload))) {
            deps.setUnreadChannelIds(id, unread);
            deps.patchChannel(id, { mentions });
          }
          break;
        }
        case "user_invalidated": {
          const ids: string[] = payload.users ?? (payload.user ? [payload.user] : []);
          for (const id of ids) deps.invalidateUser(id);
          break;
        }
        default:
          break;
      }
    });

    const reconnect = () => {
      socket = null;
      setTimeout(connectSocket, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.7, MAX_RECONNECT_DELAY);
    };
    socket.addEventListener("close", reconnect);
    socket.addEventListener("error", () => socket?.close());
  }

  connectSocket();
  onCleanup(() => socket?.close());

  createEffect(() => {
    const view = deps.activeView();
    if (view) send({ type: "watch_channel", channel: view.id });
  });

  createEffect(() => {
    const thread = deps.activeThread();
    if (thread) send({ type: "watch_thread", channel: thread.channelId, ts: thread.ts });
  });

  return { rtmConnected, send };
}
