import type {
  ActivityItem,
  Channel,
  DirectMessage,
  Message,
  ModalView,
  User,
} from "@slock/slack-api";
import { mapMessage, parseBadgeCounts } from "@slock/slack-api";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { isDmId } from "../../../dmId";
import type { MessageLocation, ThreadRef, View } from "../types";
import { classifyIncomingActivity } from "./activity";
import { mergeMessages } from "./merge/messageMerge";

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}
export function createRealtimeSlice(deps: {
  activeView: () => View | null;
  activeThread: () => ThreadRef | null;
  currentUser: () => User | undefined;
  channels: () => Channel[];
  patchChannel: (id: string, patch: Partial<Channel>) => void;
  setUnreadChannelIds: (id: string, unread: boolean) => void;
  setLastReadByChannel: (id: string, ts: number) => void;
  setPresenceOverrides: (id: string, presence: "active" | "away") => void;
  invalidateUser: (id: string) => void;
  recordTyping: (channelId: string, threadTs: string | undefined, userId: string) => void;
  clearTyping: (channelId: string, threadTs: string | undefined, userId: string) => void;
  allDirectMessages: () => DirectMessage[];
  setDmLastActivity: (id: string, ts: number) => void;
  closedDmIds: Record<string, boolean>;
  setClosedDmIds: (id: string, closed: boolean) => void;
  ensureDm: (channelId: string, userId: string) => void;
  patchDm: (id: string, patch: Partial<DirectMessage>) => void;
  isChannelNotifyAll: (id: string) => boolean;
  matchingHighlightWord: (text: string) => string | undefined;
  openModalView: (view: ModalView) => void;
  pushActivity: (item: ActivityItem) => void;
  recordActivityEngagement: (channelId: string, ts: string, threadTs?: string) => void;
  setGatewayActivityBadgeCounts: (activity: any) => void;
  messagesByChannel: Record<string, Message[]>;
  setMessagesByChannel: (channelId: string, updater: (existing?: Message[]) => Message[]) => void;
  threadMessages: Record<string, Message[]>;
  setThreadMessages: (threadTs: string, updater: (existing?: Message[]) => Message[]) => void;
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
    itemUserId?: string,
  ) => void;
}) {
  const [rtmConnected, setRtmConnected] = createSignal(false);
  let socket: WebSocket | null = null;
  let reconnectDelay = 1000;
  const MaxReconnectDelay = 20000;

  function send(payload: unknown) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }
  function handleIncomingMessage(payload: any) {
    const { channel, subtype, ts } = payload;
    if (subtype === "message_changed") {
      const updated = payload.message;
      if (!updated?.ts) return;
      const isBroadcast = updated.subtype === "thread_broadcast";
      deps.patchMessage(channel, updated.ts, {
        blocks: updated.blocks,
        edited: !!updated.edited,
        isBroadcast,
        text: updated.text,
      });
      if (isBroadcast && deps.loadedChannels.has(channel)) {
        const msg = deps
          .findAllMessageLocations(channel, updated.ts)[0]
          ?.list.find((m) => m.ts === updated.ts);
        if (msg) deps.insertMessageInOrder(channel, msg);
      }
      return;
    }
    if (subtype === "message_replied") {
      const updated = payload.message;
      if (!updated?.ts) return;
      const { lastReplyLabel, replyCount, replyUsers } = mapMessage(updated);
      deps.patchMessage(channel, updated.ts, { lastReplyLabel, replyCount, replyUsers });
      return;
    }
    if (subtype === "message_deleted") {
      const ts = payload.deleted_ts;
      if (!ts) return;
      deps.patchMessage(channel, ts, { deleted: true });
      return;
    }
    if (!ts) return;
    const msg = mapMessage(payload);
    if (msg.isEphemeral) {
      if (deps.loadedChannels.has(channel)) {
        deps.setMessagesByChannel(channel, (existing: Message[] = []) => [...existing, msg]);
      }
      return;
    }
    const me = deps.currentUser();
    const isThreadReply = !!payload.thread_ts && payload.thread_ts !== ts;
    let threadRelevant = false;
    deps.clearTyping(channel, isThreadReply ? payload.thread_ts : undefined, msg.userId);
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
    // Slack echoes messages sent by this account from its other clients. They
    // are already read by definition and must not create a local unread dot.
    if (me && msg.userId !== me.id && channel !== activeId && !isThreadReply) {
      deps.setUnreadChannelIds(channel, true);
    }
    if (deps.allDirectMessages().some((d) => d.id === channel)) {
      deps.setDmLastActivity(channel, Date.now());
      if (deps.closedDmIds[channel]) deps.setClosedDmIds(channel, false);
    } else if (channel.startsWith("D") && me && msg.userId !== me.id) {
      deps.ensureDm(channel, msg.userId);
      deps.setDmLastActivity(channel, Date.now());
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
          // A regular DM ("D..." id) is recognized without needing local
          // data; a multi-person DM shares private channels' "G..." id
          // namespace, so that case still needs the loaded-dms fallback.
          isDirectMessage: (id) =>
            isDmId(id, (candidate) => deps.allDirectMessages().some((d) => d.id === candidate)),
          isNotifyAll: deps.isChannelNotifyAll,
          matchingHighlightWord: deps.matchingHighlightWord,
        },
      );
      if (activity) {
        deps.pushActivity(activity);
        if (activity.kind === "mention") {
          const current = deps.channels().find((c) => c.id === channel)?.mentions ?? 0;
          deps.patchChannel(channel, { mentions: current + 1 });
        } else if (activity.kind === "dm") {
          const current = deps.allDirectMessages().find((d) => d.id === channel)?.mentions ?? 0;
          deps.patchDm(channel, { mentions: current + 1 });
        }
      }
    } else if (me && msg.userId === me.id) {
      deps.recordActivityEngagement(channel, ts, isThreadReply ? payload.thread_ts : undefined);
    }
  }
  function connectSocket() {
    socket = new WebSocket(wsUrl());
    socket.addEventListener("open", () => {
      reconnectDelay = 1000;
      for (const channel of deps.loadedChannels) send({ channel, type: "watch_channel" });
      const thread = deps.activeThread();
      if (thread) send({ channel: thread.channelId, ts: thread.ts, type: "watch_thread" });
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
          if (!(payload.item?.channel && payload.item?.ts)) break;
          if (payload.user === deps.currentUser()?.id) {
            if (payload.type === "reaction_added") {
              deps.recordActivityEngagement(payload.item.channel, payload.item.ts);
            }
          } else {
            deps.applyReactionEvent(
              payload.item.channel,
              payload.item.ts,
              payload.reaction,
              payload.user,
              payload.type === "reaction_added",
              payload.item_user,
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
            if (!unread) deps.setUnreadChannelIds(id, false);
            if (id.startsWith("D")) deps.patchDm(id, { mentions });
            else deps.patchChannel(id, { mentions });
          }
          deps.setGatewayActivityBadgeCounts(payload.activity_v2);
          break;
        }
        case "channel_marked": {
          // Sent when Slack advances this account's read cursor, including from
          // another client. The event's zero counts are authoritative, even if
          // we did not receive the corresponding conversations.mark response.
          if (!payload.channel) break;
          deps.setUnreadChannelIds(payload.channel, false);
          deps.patchChannel(payload.channel, { mentions: 0 });
          const readTs = Number(payload.ts) * 1000;
          if (Number.isFinite(readTs)) deps.setLastReadByChannel(payload.channel, readTs);
          break;
        }
        case "user_invalidated": {
          const ids: string[] = payload.users ?? (payload.user ? [payload.user] : []);
          for (const id of ids) deps.invalidateUser(id);
          break;
        }
        case "view_opened":
          if (payload.view_type === "modal" && payload.view) deps.openModalView(payload.view);
          break;
        default:
          break;
      }
    });
    const reconnect = () => {
      socket = null;
      setTimeout(connectSocket, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.7, MaxReconnectDelay);
    };
    socket.addEventListener("close", reconnect);
    socket.addEventListener("error", () => socket?.close());
  }
  connectSocket();
  onCleanup(() => socket?.close());
  createEffect(() => {
    const view = deps.activeView();
    if (view) send({ channel: view.id, type: "watch_channel" });
  });
  createEffect(() => {
    const thread = deps.activeThread();
    if (thread) send({ channel: thread.channelId, ts: thread.ts, type: "watch_thread" });
  });
  return { rtmConnected, send };
}
