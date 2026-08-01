// biome-ignore-all lint/performance/noBarrelFile lint/style/noExcessiveLinesPerFile: These re-exports form one cohesive messaging slice API.
import type { ActivityItem, ConversationViewData, Message, User } from "@slock/slack-api";
import {
  broadcastReply,
  deleteMessage,
  editMessage,
  postMessage,
  toggleReaction,
} from "@slock/slack-api";
import { createStore, produce } from "solid-js/store";
import { actionFeedback } from "../feedback";
import type { MessageLocation, ThreadRef, View } from "../types";
import { createMessageMergeActions } from "./merge/messageMergeActions";
import { createMessageHistory } from "./messageHistory";
import { copyMessageLink, prepareReplyLink, remindAboutMessage } from "./messageLinks";
import { findMessageLocations } from "./messageLocations";
import { createMessageStatusActions } from "./messageStatusActions";
import { createReactionEvents } from "./reactionEvents";
import { restoreFailedReaction } from "./reactions/reactionRollback";

export { REMINDER_OPTIONS } from "./messageLinks";

export function createMessagesSlice(deps: {
  currentUser: () => User | undefined;
  pushActivity: (item: ActivityItem) => void;
  recordActivityEngagement: (channelId: string, ts: string, threadTs?: string) => void;
  clearChannelUnread: (channelId: string) => void;
  setLastReadByChannel: (channelId: string, ts: number) => void;
  setUnreadDividerTs: (channelId: string, ts: number) => void;
  setUnreadChannelIds: (channelId: string, unread: boolean) => void;
  setChannelRead: (channelId: string, ts: string) => Promise<boolean>;
  syncChannelRead: (channelId: string, ts: string) => Promise<boolean>;
  activeView: () => View | null;
  activeThread: () => ThreadRef | null;
  onConversationView?: (view: ConversationViewData) => void;
}) {
  const history = createMessageHistory({
    activeThread: deps.activeThread,
    activeView: deps.activeView,
    onConversationView: deps.onConversationView,
  });
  const {
    messagesByChannel,
    setMessagesByChannel,
    reactionMessages,
    setReactionMessages,
    loadedChannels,
    threadMessages,
    setThreadMessages,
    loadedThreads,
    loadOlderMessages,
    loadOlderMessagesThrough,
    loadNewerMessages,
    loadRecentHistory,
    hasMoreHistory,
    hasNewerHistory,
    hasNewerHistoryError,
    hasOlderHistoryError,
    hasHistoryError,
    hasThreadError,
    isLoadingHistory,
    isLoadingThread,
    ensureChannelMessage,
    ensureThreadRepliesLoaded,
  } = history;
  const statusActions = createMessageStatusActions({
    clearChannelUnread: deps.clearChannelUnread,
    messagesByChannel,
    patchMessage: (channelId, ts, patch) => patchMessage(channelId, ts, patch),
    setLastReadByChannel: deps.setLastReadByChannel,
    setChannelRead: deps.setChannelRead,
    setUnreadChannelIds: deps.setUnreadChannelIds,
    setUnreadDividerTs: deps.setUnreadDividerTs,
    syncChannelRead: deps.syncChannelRead,
    threadMessages,
  });
  const mergeActions = createMessageMergeActions({
    currentUser: deps.currentUser,
    setMessagesByChannel: (channelId, update) => setMessagesByChannel(channelId, update),
  });
  const findAllMessageLocations = (channelId: string, ts: string) =>
    findMessageLocations(messagesByChannel, threadMessages, reactionMessages, channelId, ts);
  const setStore = {
    channel: setMessagesByChannel,
    reaction: setReactionMessages,
    thread: setThreadMessages,
  } as const;
  function patchMessage(channelId: string, ts: string, patch: Partial<Message>) {
    for (const { location } of findAllMessageLocations(channelId, ts)) {
      setStore[location.store](
        location.key,
        produce((list) => {
          const msg = list.find((m) => m.ts === ts);
          if (msg) Object.assign(msg, patch);
        }),
      );
    }
  }
  function removeMessage(location: MessageLocation, ts: string) {
    setStore[location.store](
      location.key,
      produce((list) => {
        const idx = list.findIndex((m) => m.ts === ts);
        if (idx !== -1) list.splice(idx, 1);
      }),
    );
  }
  const { applyReactionEvent } = createReactionEvents({
    currentUser: deps.currentUser,
    findAllMessageLocations,
    patchMessage,
    pushActivity: deps.pushActivity,
  });
  const [reactionPending, setReactionPending] = createStore<Record<string, boolean>>({});
  const reactionPendingKey = (channelId: string, ts: string, emojiName: string) =>
    `${channelId}:${ts}:${emojiName}`;
  function isReactionPending(channelId: string, ts: string, emojiName: string): boolean {
    return !!reactionPending[reactionPendingKey(channelId, ts, emojiName)];
  }
  async function sendMessage(
    channelId: string,
    text: string,
    threadTs?: string,
    blocks?: unknown,
    suppressUnfurl?: boolean,
  ) {
    const trimmed = text.trim();
    if (!(trimmed || blocks)) return;
    const me = deps.currentUser();
    const now = Date.now();
    const optimistic: Message = {
      blocks: blocks as Message["blocks"],
      day: "Today",
      id: `pending-${now}`,
      kind: "normal",
      text: trimmed,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      ts: String(now / 1000),
      userId: me?.id ?? "",
    };
    const key = threadTs ?? channelId;
    const location: MessageLocation = threadTs
      ? { key, store: "thread" }
      : { key, store: "channel" };
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
      const resolvePending = (list: Message[]) =>
        list.some((m) => m.id !== optimistic.id && (m.ts === realTs || m.id === realTs))
          ? list.filter((m) => m.id !== optimistic.id)
          : list.map((m) => (m.id === optimistic.id ? { ...m, id: realTs, ts: realTs } : m));
      if (location.store === "channel") {
        setMessagesByChannel(location.key, resolvePending);
      } else {
        setThreadMessages(location.key, resolvePending);
      }
      deps.recordActivityEngagement(channelId, realTs, threadTs);
    } catch (err) {
      console.error("Failed to send message", err);
      removeMessage(location, optimistic.ts);
      throw err;
    }
  }
  async function editMessageText(channelId: string, ts: string, text: string, blocks?: unknown) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    try {
      await editMessage(channelId, ts, trimmed, blocks);
      patchMessage(channelId, ts, {
        blocks: blocks as Message["blocks"],
        edited: true,
        text: trimmed,
      });
      return true;
    } catch (err) {
      console.error("Failed to edit message", err);
      actionFeedback.flash(ts, "Failed to edit message.", "error");
      return false;
    }
  }
  async function broadcastThreadReply(channelId: string, ts: string) {
    patchMessage(channelId, ts, { isBroadcast: true });
    try {
      await broadcastReply(channelId, ts);
      const broadcasted = findAllMessageLocations(channelId, ts)[0]?.list.find((m) => m.ts === ts);
      if (broadcasted && loadedChannels.has(channelId))
        mergeActions.insertMessageInOrder(channelId, broadcasted);
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
    const pendingKey = reactionPendingKey(channelId, msg.ts, emojiName);
    if (!me || reactionPending[pendingKey]) return;
    setReactionPending(pendingKey, true);
    const previousReactions = msg.reactions;
    const reactions = previousReactions ?? [];
    const existing = reactions.find((r) => r.name === emojiName);
    const existingIndex = reactions.findIndex((r) => r.name === emojiName);
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
      nextReactions = [...reactions, { count: 1, name: emojiName, users: [me.id] }];
    }
    patchMessage(channelId, msg.ts, { reactions: nextReactions });
    try {
      await toggleReaction(channelId, msg.ts, emojiName, alreadyReacted);
      if (!alreadyReacted) {
        const threadTs = msg.threadTs ?? ((msg.replyCount ?? 0) > 0 ? msg.ts : undefined);
        deps.recordActivityEngagement(channelId, msg.ts, threadTs);
      }
    } catch (err) {
      console.error("Failed to toggle reaction", err);
      actionFeedback.flash(msg.ts, "Failed to update reaction.", "error");
      const current = findAllMessageLocations(channelId, msg.ts)[0]?.list.find(
        (candidate) => candidate.ts === msg.ts,
      )?.reactions;
      patchMessage(channelId, msg.ts, {
        reactions: restoreFailedReaction(current, emojiName, existing, existingIndex),
      });
    } finally {
      setReactionPending(
        produce((pending) => {
          delete pending[pendingKey];
        }),
      );
    }
  }
  return {
    ensureChannelMessage,
    ensureThreadRepliesLoaded,
    findAllMessageLocations,
    reactionMessages,
    hasHistoryError,
    hasMoreHistory,
    hasNewerHistory,
    hasNewerHistoryError,
    hasOlderHistoryError,
    hasThreadError,
    isLoadingHistory,
    isLoadingThread,
    isReactionPending,
    loadedChannels,
    loadedThreads,
    loadOlderMessages,
    loadOlderMessagesThrough,
    loadNewerMessages,
    loadRecentHistory,
    messagesByChannel,
    patchMessage,
    removeMessage,
    setMessagesByChannel,
    setReactionMessages,
    setThreadMessages,
    threadMessages,
    ...mergeActions,
    applyReactionEvent,
    broadcastThreadReply,
    deleteMessageAt,
    editMessageText,
    reactToMessage,
    sendMessage,
    ...statusActions,
    copyMessageLink,
    prepareReplyLink,
    remindAboutMessage,
  };
}
