import type { Channel, DirectMessage, Message, ModalView, User } from "@slock/slack-api";
import { HIDE_SUBTYPES, mapMessage, parseBadgeCounts } from "@slock/slack-api";
import { createEffect } from "solid-js";
import type { MessageLocation, ThreadRef, View } from "../types";
import { createRealtimeConnection } from "./connection/realtimeConnection";
import { mergeMessages } from "./merge/messageMerge";

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}
export function createRealtimeSlice(deps: {
  visibleViews: () => View[];
  visibleThreads: () => ThreadRef[];
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
  closedDmIds: Record<string, boolean>;
  setClosedDmIds: (id: string, closed: boolean) => void;
  ensureDm: (channelId: string, userId: string) => void;
  patchDm: (id: string, patch: Partial<DirectMessage>) => void;
  openModalView: (view: ModalView) => void;
  setGatewayActivityBadgeCounts: (activity: any) => boolean;
  refreshActivityFeed: () => void;
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
  function send(payload: unknown) {
    return connection.send(payload);
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
        deps.setMessagesByChannel(channel, (existing: Message[] = []) =>
          deps.mergeIncomingMessage(existing, msg),
        );
      }
      return;
    }
    const me = deps.currentUser();
    const isThreadReply = !!payload.thread_ts && payload.thread_ts !== ts;
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
      }
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
    // Slack echoes messages sent by this account from its other clients. They
    // are already read by definition and must not create a local unread dot.
    if (
      me &&
      msg.userId !== me.id &&
      !isThreadReply &&
      !deps.visibleViews().some((v) => v.id === channel)
    ) {
      deps.setUnreadChannelIds(channel, true);
    }
    if (deps.allDirectMessages().some((d) => d.id === channel)) {
      if (deps.closedDmIds[channel]) deps.setClosedDmIds(channel, false);
    } else if (channel.startsWith("D") && me && msg.userId !== me.id) {
      deps.ensureDm(channel, msg.userId);
    } else if (deps.channels().some((c) => c.id === channel)) {
      deps.patchChannel(channel, { lastActivity: Date.now() });
    }
  }
  function handleRawMessage(raw: string) {
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    switch (payload.type) {
      case "_status":
        connection.setGatewayConnected(!!payload.connected);
        break;
      case "_history_snapshot":
        if (deps.loadedChannels.has(payload.channel)) {
          const fresh = (payload.messages ?? [])
            .filter((m: any) => m.type === "message" && !HIDE_SUBTYPES.has(m.subtype))
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
            .filter((m: any) => m.type === "message" && !HIDE_SUBTYPES.has(m.subtype))
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
        // Our own reactToMessage already applies the optimistic update;
        // re-applying it here on the gateway echo would double-count it.
        if (payload.user !== deps.currentUser()?.id) {
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
        const activityCountsChanged = deps.setGatewayActivityBadgeCounts(payload.activity_v2);
        // The gateway only pushes aggregate counts, never the entries
        // themselves. Identical snapshots are common, so only a real count
        // change should schedule a coalesced activity.feed refresh.
        if (activityCountsChanged) deps.refreshActivityFeed();
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
  }
  const connection = createRealtimeConnection({
    onMessage: handleRawMessage,
    onOpen: () => {
      for (const channel of deps.loadedChannels) send({ channel, type: "watch_channel" });
      for (const thread of deps.visibleThreads())
        send({ channel: thread.channelId, ts: thread.ts, type: "watch_thread" });
    },
    url: wsUrl,
  });
  createEffect(() => {
    for (const view of deps.visibleViews()) send({ channel: view.id, type: "watch_channel" });
  });
  createEffect(() => {
    for (const thread of deps.visibleThreads())
      send({ channel: thread.channelId, ts: thread.ts, type: "watch_thread" });
  });
  return {
    connectionState: connection.connectionState,
    isSelfOnline: connection.isSelfOnline,
    retryConnection: connection.retry,
    rtmConnected: connection.rtmConnected,
    send,
  };
}
