import { produce } from "solid-js/store";
import type { ActivityItem, Block, ConversationViewData, Message, User } from "../../../api";
import {
  broadcastRangeFromBlocks,
  broadcastReply,
  deleteMessage,
  editMessage,
  postBroadcastMessage,
  postMessage,
} from "../../../api";
import { flashError, undoStack } from "../../../feedback";
import {
  latestMessageTsMsByUser as findLatestMessageTsMsByUser,
  findMessageLocations,
  reactionMessageKey,
} from "../../../messageLocations";
import { dedupeMessages } from "../../../messageMerge";
import type { ChannelMessageTarget, MessageLocation, ThreadRef, View } from "../types";
import { createMessageMergeActions } from "./merge/messageMergeActions";
import { createMessageHistory } from "./messageHistory";
import { createMessageReactionToggle } from "./messageReactionToggle";
import { createMessageStatusActions } from "./messageStatusActions";
import { createReactionEvents } from "./reactionEvents";

export function createMessagesSlice(deps: {
  currentUser: () => User | undefined;
  pushActivity: (item: ActivityItem) => void;
  clearChannelUnread: (channelId: string) => void;
  setLastReadByChannel: (channelId: string, ts: number) => void;
  setUnreadDividerTs: (channelId: string, ts: number) => void;
  setUnreadChannelIds: (channelId: string, unread: boolean) => void;
  setChannelRead: (channelId: string, ts: string) => Promise<boolean>;
  syncChannelRead: (channelId: string, ts: string) => Promise<boolean>;
  setThreadRead: (channelId: string, threadTs: string, ts: string) => Promise<boolean>;
  visibleMessageTargets: () => ChannelMessageTarget[];
  visibleViews: () => View[];
  visibleThreads: () => ThreadRef[];
  onConversationView?: (view: ConversationViewData) => void;
}) {
  const history = createMessageHistory({
    onConversationView: deps.onConversationView,
    visibleMessageTargets: deps.visibleMessageTargets,
    visibleThreads: deps.visibleThreads,
    visibleViews: deps.visibleViews,
  });
  const {
    messagesByChannel,
    setMessagesByChannel,
    reactionMessages,
    setReactionMessages,
    loadedChannels,
    threadMessages,
    setThreadMessages: setThreadMessagesRaw,
    isThreadKnown,
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
    jumpToBeginning,
    jumpToDate,
    refreshThreadReplies,
  } = history;
  const setThreadMessages: typeof setMessagesByChannel = setThreadMessagesRaw;
  const statusActions = createMessageStatusActions({
    clearChannelUnread: deps.clearChannelUnread,
    hasMoreHistory,
    messagesByChannel,
    patchMessage: (channelId, ts, patch) => patchMessage(channelId, ts, patch),
    setLastReadByChannel: deps.setLastReadByChannel,
    setChannelRead: deps.setChannelRead,
    setThreadRead: deps.setThreadRead,
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
  const latestMessageTsMsByUser = (userId: string) =>
    findLatestMessageTsMsByUser(messagesByChannel, threadMessages, userId);
  const messagesInChannel = (channelId: string) => messagesByChannel[channelId];
  const messagesInThread = (threadTs: string) => threadMessages[threadTs];
  const reactionMessageFor = (channelId: string, ts: string) =>
    reactionMessages[reactionMessageKey(channelId, ts)]?.[0];
  const setStore = {
    channel: setMessagesByChannel,
    reaction: setReactionMessages,
    thread: setThreadMessages,
  } as const;
  function patchMessage(channelId: string, ts: string, patch: Partial<Message>) {
    for (const { location } of findAllMessageLocations(channelId, ts)) {
      setStore[location.store](location.key, (list) =>
        list.map((m) => (m.ts === ts ? { ...m, ...patch } : m)),
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
  const { isReactionPending, reactToMessage } = createMessageReactionToggle({
    currentUser: deps.currentUser,
    findAllMessageLocations,
    patchMessage,
  });
  async function sendMessage(
    channelId: string,
    text: string,
    threadTs?: string,
    blocks?: Block[],
    suppressUnfurl?: boolean,
  ) {
    const trimmed = text.trim();
    if (!(trimmed || blocks)) return;
    const hasBroadcast = !!broadcastRangeFromBlocks(blocks);
    const me = deps.currentUser();
    const now = Date.now();
    const optimistic: Message = {
      blocks,
      day: "Today",
      id: `pending-${now}`,
      kind: "normal",
      text: trimmed,
      time: new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
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
      const res = hasBroadcast
        ? await postBroadcastMessage(channelId, trimmed, threadTs, blocks, suppressUnfurl)
        : await postMessage(channelId, trimmed, threadTs, blocks, suppressUnfurl);
      const realTs = res.ts;

      const resolvePending = (list: Message[]) =>
        dedupeMessages(list.map((m) => (m.id === optimistic.id ? { ...m, ts: realTs } : m)));
      if (location.store === "channel") {
        setMessagesByChannel(location.key, resolvePending);
      } else {
        setThreadMessages(location.key, resolvePending);
      }
    } catch (err) {
      console.error("Failed to send message", err);
      removeMessage(location, optimistic.ts);
      throw err;
    }
  }
  async function editMessageText(channelId: string, ts: string, text: string, blocks?: Block[]) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const previous = findAllMessageLocations(channelId, ts)[0]?.list.find((m) => m.ts === ts);
    const relayed = !!previous && previous.userId !== deps.currentUser()?.id;
    try {
      await editMessage(channelId, ts, trimmed, blocks, relayed);
      patchMessage(channelId, ts, {
        blocks,
        edited: true,
        text: trimmed,
      });
      if (previous && previous.text !== trimmed) {
        undoStack.push({
          label: "edit message",
          undo: () => void editMessageText(channelId, ts, previous.text, previous.blocks),
        });
      }
      return true;
    } catch (err) {
      console.error("Failed to edit message", err);
      flashError(ts, "Failed to edit message.");
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
      flashError(ts, "Failed to send to channel.");
      patchMessage(channelId, ts, { isBroadcast: false });
    }
  }
  async function deleteMessageAt(channelId: string, ts: string) {
    const previous = findAllMessageLocations(channelId, ts)[0]?.list.find((m) => m.ts === ts);
    const relayed = !!previous && previous.userId !== deps.currentUser()?.id;
    try {
      await deleteMessage(channelId, ts, relayed);
      patchMessage(channelId, ts, { deleted: true });
    } catch (err) {
      console.error("Failed to delete message", err);
      flashError(ts, "Failed to delete message.");
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
    isThreadKnown,
    jumpToBeginning,
    jumpToDate,
    latestMessageTsMsByUser,
    loadedChannels,
    loadOlderMessages,
    loadOlderMessagesThrough,
    loadNewerMessages,
    loadRecentHistory,
    messagesByChannel,
    messagesInChannel,
    messagesInThread,
    patchMessage,
    reactionMessageFor,
    refreshThreadReplies,
    removeMessage,
    setMessagesByChannel,
    setReactionMessages,
    setThreadMessages,
    threadMessages,
    broadcastThreadReply,
    deleteMessageAt,
    editMessageText,
    reactToMessage,
    sendMessage,
    ...statusActions,
    realtimeHooks: {
      applyReactionEvent,
      insertMessageInOrder: mergeActions.insertMessageInOrder,
      mergeIncomingMessage: mergeActions.mergeIncomingMessage,
    },
  };
}
