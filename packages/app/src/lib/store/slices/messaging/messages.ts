import type { ActivityItem, Message, User } from "@slock/slack-api";
import {
  broadcastReply,
  deleteMessage,
  editMessage,
  fetchHistory,
  fetchReplies,
  markChannelRead,
  postMessage,
  toggleReaction,
  toggleThreadSubscription,
} from "@slock/slack-api";
import { createEffect } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { actionFeedback } from "../feedback";
import type { MessageLocation, ThreadRef, View } from "../types";
import { copyMessageLink, prepareReplyLink, remindAboutMessage } from "./messageLinks";

export { REMINDER_OPTIONS } from "./messageLinks";
export { mergeMessages } from "./messageMerge";

export function createMessagesSlice(deps: {
  currentUser: () => User | undefined;
  pushActivity: (item: ActivityItem) => void;
  clearChannelUnread: (channelId: string) => void;
  setLastReadByChannel: (channelId: string, ts: number) => void;
  setUnreadDividerTs: (channelId: string, ts: number) => void;
  setUnreadChannelIds: (channelId: string, unread: boolean) => void;
  activeView: () => View | null;
  activeThread: () => ThreadRef | null;
}) {
  const [messagesByChannel, setMessagesByChannel] = createStore<Record<string, Message[]>>({});
  const loadedChannels = new Set<string>();
  // Cursor for the next (older) page of a channel's history, from
  // conversations.history's response_metadata.next_cursor. Not reactive — only
  // loadOlderMessages reads it, so it doesn't need to drive re-renders.
  const historyCursor = new Map<string, string | undefined>();
  const [historyMeta, setHistoryMeta] = createStore<
    Record<string, { hasMore: boolean; loading: boolean }>
  >({});

  const [threadMessages, setThreadMessages] = createStore<Record<string, Message[]>>({});
  const loadedThreads = new Set<string>();

  createEffect(() => {
    const view = deps.activeView();
    if (!view) return;
    if (loadedChannels.has(view.id)) return;
    loadedChannels.add(view.id);
    fetchHistory(view.id)
      .then(({ messages, hasMore, nextCursor }) => {
        setMessagesByChannel(view.id, messages);
        historyCursor.set(view.id, nextCursor);
        setHistoryMeta(view.id, { hasMore, loading: false });
      })
      .catch(() => {
        loadedChannels.delete(view.id);
      });
  });

  createEffect(() => {
    const thread = deps.activeThread();
    if (!thread) return;
    const key = thread.ts;
    if (loadedThreads.has(key)) return;
    loadedThreads.add(key);
    fetchReplies(thread.channelId, thread.ts)
      .then((messages) => {
        setThreadMessages(key, messages);
      })
      .catch(() => {
        loadedThreads.delete(key);
      });
  });

  function hasMoreHistory(channelId: string) {
    // Unknown (not loaded yet) defaults to true so the "beginning of channel"
    // intro doesn't flash before the first page has actually confirmed it.
    return historyMeta[channelId]?.hasMore ?? true;
  }

  function isLoadingHistory(channelId: string) {
    return historyMeta[channelId]?.loading ?? false;
  }

  async function loadOlderMessages(channelId: string) {
    if (!loadedChannels.has(channelId)) return;
    const meta = historyMeta[channelId];
    if (meta?.loading || meta?.hasMore === false) return;
    const cursor = historyCursor.get(channelId);
    if (!cursor) {
      setHistoryMeta(channelId, "hasMore", false);
      return;
    }
    setHistoryMeta(channelId, "loading", true);
    try {
      const { messages: older, hasMore, nextCursor } = await fetchHistory(channelId, cursor);
      setMessagesByChannel(channelId, (existing = []) => {
        const existingIds = new Set(existing.map((m) => m.id));
        return [...older.filter((m) => !existingIds.has(m.id)), ...existing];
      });
      historyCursor.set(channelId, nextCursor);
      setHistoryMeta(channelId, { hasMore, loading: false });
    } catch {
      setHistoryMeta(channelId, "loading", false);
    }
  }

  // A thread's parent message is stored twice — once in the channel's own
  // list, once as the first entry of its thread list — so any patch (edit,
  // delete, reaction, reply count) has to hit every copy or one view goes
  // stale until reload. Same ts can't collide across channels/threads since
  // Slack timestamps are effectively unique.
  function findAllMessageLocations(
    channelId: string,
    ts: string,
  ): { location: MessageLocation; list: Message[] }[] {
    const results: { location: MessageLocation; list: Message[] }[] = [];
    const inChannel = messagesByChannel[channelId];
    if (inChannel?.some((m) => m.ts === ts))
      results.push({ location: { store: "channel", key: channelId }, list: inChannel });
    for (const key of Object.keys(threadMessages)) {
      const list = threadMessages[key];
      if (list?.some((m) => m.ts === ts))
        results.push({ location: { store: "thread", key }, list });
    }
    return results;
  }

  function patchMessage(channelId: string, ts: string, patch: Partial<Message>) {
    for (const { location } of findAllMessageLocations(channelId, ts)) {
      if (location.store === "channel") {
        setMessagesByChannel(
          location.key,
          produce((list) => {
            const msg = list.find((m) => m.ts === ts);
            if (msg) Object.assign(msg, patch);
          }),
        );
      } else {
        setThreadMessages(
          location.key,
          produce((list) => {
            const msg = list.find((m) => m.ts === ts);
            if (msg) Object.assign(msg, patch);
          }),
        );
      }
    }
  }

  function removeMessage(location: MessageLocation, ts: string) {
    const remove = (list: Message[]) => {
      const idx = list.findIndex((m) => m.ts === ts);
      if (idx !== -1) list.splice(idx, 1);
    };
    if (location.store === "channel") {
      setMessagesByChannel(location.key, produce(remove));
    } else {
      setThreadMessages(location.key, produce(remove));
    }
  }

  // Broadcasting a reply surfaces a message whose ts can be much older than
  // anything currently at the end of the channel's list (it was written
  // whenever the original reply was sent), so — unlike genuinely new
  // messages, which mergeIncomingMessage can safely just append — it has to
  // be sorted into chronological position instead.
  function insertMessageInOrder(channelId: string, msg: Message) {
    setMessagesByChannel(channelId, (existing = []) => {
      if (existing.some((m) => m.ts === msg.ts)) return existing;
      const idx = existing.findIndex((m) => parseFloat(m.ts) > parseFloat(msg.ts));
      if (idx === -1) return [...existing, msg];
      return [...existing.slice(0, idx), msg, ...existing.slice(idx)];
    });
  }

  // Our own sent messages are added optimistically (see sendMessage) under a
  // temporary "pending-*" id/ts before the post resolves. The websocket often
  // echoes that same message back before the post's response arrives, so a
  // plain ts/id dedup check misses it (the pending entry still has the fake
  // client-side ts) and the message would otherwise get appended a second time.
  // Replacing the still-pending entry in place here, and having sendMessage's
  // resolution back off if it sees the real ts already present (below), covers
  // both orderings of that race.
  function mergeIncomingMessage(existing: Message[], msg: Message): Message[] {
    if (existing.some((m) => m.ts === msg.ts || m.id === msg.ts)) return existing;
    const me = deps.currentUser();
    if (me && msg.userId === me.id) {
      const pendingIdx = existing.findIndex(
        (m) => m.id.startsWith("pending-") && m.text === msg.text,
      );
      if (pendingIdx !== -1) {
        const next = existing.slice();
        next[pendingIdx] = msg;
        return next;
      }
    }
    return [...existing, msg];
  }

  function applyReactionEvent(
    channel: string,
    ts: string,
    name: string,
    userId: string,
    added: boolean,
  ) {
    const locations = findAllMessageLocations(channel, ts);
    if (locations.length === 0) return;
    const msg = locations[0].list.find((m) => m.ts === ts);
    if (!msg) return;
    const reactions = msg.reactions ?? [];
    const existing = reactions.find((r) => r.name === name);
    let next: typeof reactions;
    if (added) {
      next = existing
        ? reactions.map((r) =>
            r.name === name ? { ...r, count: r.count + 1, users: [...r.users, userId] } : r,
          )
        : [...reactions, { name, count: 1, users: [userId] }];
    } else if (existing) {
      next = reactions
        .map((r) =>
          r.name === name
            ? { ...r, count: r.count - 1, users: r.users.filter((u) => u !== userId) }
            : r,
        )
        .filter((r) => r.count > 0);
    } else {
      next = reactions;
    }
    patchMessage(channel, ts, { reactions: next });

    const me = deps.currentUser();
    if (added && me && msg.userId === me.id && userId !== me.id) {
      deps.pushActivity({
        id: `rx-${channel}-${ts}-${name}-${userId}-${Date.now()}`,
        kind: "reaction",
        channelId: channel,
        ts,
        userId,
        text: msg.text,
        time: Date.now(),
        reactionName: name,
      });
    }
  }

  async function sendMessage(
    channelId: string,
    text: string,
    threadTs?: string,
    blocks?: unknown,
    suppressUnfurl?: boolean,
  ) {
    const trimmed = text.trim();
    if (!trimmed && !blocks) return;
    const me = deps.currentUser();
    const now = Date.now();
    const optimistic: Message = {
      id: `pending-${now}`,
      ts: String(now / 1000),
      userId: me?.id ?? "",
      text: trimmed,
      blocks: blocks as Message["blocks"],
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      day: "Today",
      kind: "normal",
    };
    const key = threadTs ?? channelId;
    const location: MessageLocation = threadTs
      ? { store: "thread", key }
      : { store: "channel", key };
    if (threadTs) {
      setThreadMessages(
        produce((draft) => {
          if (!draft[key]) draft[key] = [];
          draft[key].push(optimistic);
        }),
      );
    } else {
      setMessagesByChannel(
        produce((draft) => {
          if (!draft[key]) draft[key] = [];
          draft[key].push(optimistic);
        }),
      );
    }
    try {
      const res = await postMessage(channelId, trimmed, threadTs, blocks, suppressUnfurl);
      const realTs = res.ts as string;
      // The websocket echo can beat this response back, in which case
      // mergeIncomingMessage already replaced the pending entry with the real
      // one — just drop the (now-stale) pending placeholder rather than
      // renaming it into a second copy of the same message.
      const resolvePending = (list: Message[]) =>
        list.some((m) => m.id !== optimistic.id && (m.ts === realTs || m.id === realTs))
          ? list.filter((m) => m.id !== optimistic.id)
          : list.map((m) => (m.id === optimistic.id ? { ...m, id: realTs, ts: realTs } : m));
      if (location.store === "channel") {
        setMessagesByChannel(location.key, resolvePending);
      } else {
        setThreadMessages(location.key, resolvePending);
      }
    } catch (err) {
      console.error("Failed to send message", err);
      actionFeedback.flash(key, "Failed to send.", "error");
      removeMessage(location, optimistic.ts);
    }
  }

  async function editMessageText(channelId: string, ts: string, text: string, blocks?: unknown) {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await editMessage(channelId, ts, trimmed, blocks);
      patchMessage(channelId, ts, {
        text: trimmed,
        blocks: blocks as Message["blocks"],
        edited: true,
      });
    } catch (err) {
      console.error("Failed to edit message", err);
      actionFeedback.flash(ts, "Failed to edit message.", "error");
    }
  }

  async function broadcastThreadReply(channelId: string, ts: string) {
    patchMessage(channelId, ts, { isBroadcast: true });
    try {
      await broadcastReply(channelId, ts);
      // Slack doesn't move the reply — it just also surfaces it in the
      // channel's own timeline, so mirror it into messagesByChannel the same
      // way a live broadcast event would, instead of requiring a reload.
      const broadcasted = findAllMessageLocations(channelId, ts)[0]?.list.find((m) => m.ts === ts);
      if (broadcasted && loadedChannels.has(channelId))
        insertMessageInOrder(channelId, broadcasted);
    } catch (err) {
      console.error("Failed to broadcast reply", err);
      actionFeedback.flash(ts, "Failed to send to channel.", "error");
      patchMessage(channelId, ts, { isBroadcast: false });
    }
  }

  async function deleteMessageAt(channelId: string, ts: string) {
    try {
      await deleteMessage(channelId, ts);
      patchMessage(channelId, ts, { deleted: true });
    } catch (err) {
      console.error("Failed to delete message", err);
      actionFeedback.flash(ts, "Failed to delete message.", "error");
    }
  }

  async function reactToMessage(channelId: string, msg: Message, emojiName: string) {
    const me = deps.currentUser();
    if (!me) return;
    const previousReactions = msg.reactions;
    const reactions = previousReactions ?? [];
    const existing = reactions.find((r) => r.name === emojiName);
    const alreadyReacted = !!existing?.users.includes(me.id);

    let nextReactions: typeof reactions;
    if (alreadyReacted) {
      nextReactions = reactions
        .map((r) =>
          r.name === emojiName
            ? { ...r, count: r.count - 1, users: r.users.filter((u) => u !== me.id) }
            : r,
        )
        .filter((r) => r.count > 0);
    } else if (existing) {
      nextReactions = reactions.map((r) =>
        r.name === emojiName ? { ...r, count: r.count + 1, users: [...r.users, me.id] } : r,
      );
    } else {
      nextReactions = [...reactions, { name: emojiName, count: 1, users: [me.id] }];
    }
    patchMessage(channelId, msg.ts, { reactions: nextReactions });
    try {
      await toggleReaction(channelId, msg.ts, emojiName, alreadyReacted);
    } catch (err) {
      console.error("Failed to toggle reaction", err);
      patchMessage(channelId, msg.ts, { reactions: previousReactions });
    }
  }

  function isThreadSubscribed(ts: string): boolean {
    return !!threadMessages[ts]?.[0]?.isSubscribed;
  }

  async function toggleThreadSubscribed(channelId: string, ts: string) {
    const currentlySubscribed = isThreadSubscribed(ts);
    patchMessage(channelId, ts, { isSubscribed: !currentlySubscribed });
    try {
      await toggleThreadSubscription(channelId, ts, currentlySubscribed);
    } catch (err) {
      console.error("Failed to toggle thread subscription", err);
      actionFeedback.flash(ts, "Failed to update thread subscription.", "error");
      patchMessage(channelId, ts, { isSubscribed: currentlySubscribed });
    }
  }

  function markCurrentChannelRead(channelId: string) {
    deps.clearChannelUnread(channelId);
    // History may not be loaded (e.g. marking read from the sidebar without ever
    // opening the channel) — fall back to "now" so Slack's real read cursor still
    // advances instead of only clearing the local dot.
    const list = messagesByChannel[channelId];
    const latest = list?.[list.length - 1]?.ts ?? (Date.now() / 1000).toFixed(6);
    deps.setLastReadByChannel(channelId, parseFloat(latest) * 1000);
    markChannelRead(channelId, latest).catch(() => {});
  }

  function markMessageUnread(channelId: string, ts: string) {
    const list = messagesByChannel[channelId] ?? [];
    const idx = list.findIndex((m) => m.ts === ts);
    const previousTs = idx > 0 ? list[idx - 1].ts : "0";
    const previousMs = parseFloat(previousTs) * 1000;
    // Roll the local cursor back immediately so the divider shows up right
    // away instead of waiting on a round trip to Slack.
    deps.setLastReadByChannel(channelId, previousMs);
    deps.setUnreadDividerTs(channelId, previousMs);
    markChannelRead(channelId, previousTs)
      .then(() => {
        deps.setUnreadChannelIds(channelId, true);
      })
      .catch(() => actionFeedback.flash(ts, "Failed to mark as unread.", "error"));
  }

  return {
    messagesByChannel,
    setMessagesByChannel,
    loadedChannels,
    threadMessages,
    setThreadMessages,
    loadedThreads,
    loadOlderMessages,
    hasMoreHistory,
    isLoadingHistory,
    findAllMessageLocations,
    patchMessage,
    removeMessage,
    insertMessageInOrder,
    mergeIncomingMessage,
    applyReactionEvent,
    sendMessage,
    editMessageText,
    broadcastThreadReply,
    deleteMessageAt,
    reactToMessage,
    isThreadSubscribed,
    toggleThreadSubscribed,
    markCurrentChannelRead,
    markMessageUnread,
    copyMessageLink,
    prepareReplyLink,
    remindAboutMessage,
  };
}
