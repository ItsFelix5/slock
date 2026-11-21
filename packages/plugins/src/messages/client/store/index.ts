import type { ChannelMessageTarget, View } from "@slock/plugins/conversations/client/api/types";
import { isMyRelayedMessage } from "@slock/slack";
import type { ChannelId, ConversationViewData, Message, Ts, User, UserId } from "@slock/types";
import { reconcile, snapshot } from "solid-js";
import type { ThreadRef } from "../api";
import {
  createMessageLocator,
  latestMessageTsMsByUser as findLatestMessageTsMsByUser,
  type MessageLocation,
  reactionMessageKey,
} from "../lib/messageLocations";
import { createMessageMergeActions } from "./merge/messageMergeActions";
import { createMessageHistory } from "./messageHistory";
import { createMessageMutations } from "./messageMutations";
import { createMessageReactionToggle } from "./messageReactionToggle";
import { createMessageSending } from "./messageSending";
import { createMessageStatusActions } from "./messageStatusActions";
import { createReactionEvents } from "./reactionEvents";

export function createMessagesStore(deps: {
  currentUser: () => User | undefined;
  clearChannelUnread: (channelId: ChannelId) => void;
  lastReadFor: (channelId: ChannelId) => number | undefined;
  unreadDividerTsFor: (channelId: ChannelId) => number | undefined;
  threadReadTsFor: (threadTs: Ts) => Ts | undefined;
  setLastReadByChannel: (channelId: ChannelId, ts: number) => void;
  setUnreadDividerTs: (channelId: ChannelId, ts: number) => void;
  setUnreadChannelIds: (channelId: ChannelId, unread: boolean) => void;
  setChannelRead: (channelId: ChannelId, ts: Ts) => Promise<boolean>;
  syncChannelRead: (channelId: ChannelId, ts: Ts) => Promise<boolean>;
  setThreadRead: (channelId: ChannelId, threadTs: Ts, ts: Ts) => Promise<boolean>;
  visibleMessageTargets: () => ChannelMessageTarget[];
  visibleViews: () => View[];
  visibleThreads: () => ThreadRef[];
  onConversationView?: (view: ConversationViewData) => void;
  onMessageDeleted: (channelId: ChannelId, ts: Ts) => void;
  extendPatch: (current: Message, patch: Partial<Message>) => Partial<Message>;
  retainsDeleted: (msg: Message) => boolean;
}) {
  const history = createMessageHistory({
    onConversationView: deps.onConversationView,
    visibleMessageTargets: deps.visibleMessageTargets,
    visibleThreads: deps.visibleThreads,
    visibleViews: deps.visibleViews,
  });
  const {
    messagesByChannel,
    cacheReactionMessages,
    dropThreadMessages,
    editChannelList,
    editReactionList,
    editThreadList,
    updateChannelMessages,
    updateThreadMessages,
    reactionMessages,
    loadedChannels,
    threadMessages,
    acceptsLiveReplies,
    loadOlderMessages,
    loadNewerMessages,
    loadRecentHistory,
    hasMoreHistory,
    hasNewerHistory,
    hasNewerHistoryError,
    hasOlderHistoryError,
    hasHistoryError,
    hasEarlierReplies,
    hasEarlierRepliesError,
    isLoadingEarlierReplies,
    loadEarlierReplies,
    hasMoreReplies,
    hasMoreRepliesError,
    missingReplies,
    hasThreadError,
    isLoadingMoreReplies,
    loadMoreReplies,
    isLoadingHistory,
    isLoadingThread,
    ensureChannelMessage,
    ensureThreadRepliesLoaded,
    jumpToBeginning,
    jumpToDate,
    jumpToTs,
    refreshThreadReplies,
  } = history;
  const statusActions = createMessageStatusActions({
    clearChannelUnread: deps.clearChannelUnread,
    hasMoreHistory,
    hasNewerHistory,
    messagesByChannel,
    patchMessage: (channelId, ts, patch) => patchMessage(channelId, ts, patch),
    lastReadFor: deps.lastReadFor,
    unreadDividerTsFor: deps.unreadDividerTsFor,
    setLastReadByChannel: deps.setLastReadByChannel,
    setChannelRead: deps.setChannelRead,
    setThreadRead: deps.setThreadRead,
    threadReadTsFor: deps.threadReadTsFor,
    setUnreadChannelIds: deps.setUnreadChannelIds,
    setUnreadDividerTs: deps.setUnreadDividerTs,
    syncChannelRead: deps.syncChannelRead,
    threadMessages,
  });
  const mergeActions = createMessageMergeActions({
    updateChannelMessages,
  });
  const findAllMessageLocations = createMessageLocator(
    messagesByChannel,
    threadMessages,
    reactionMessages,
  );
  function editList(location: MessageLocation, edit: (list: Message[]) => void) {
    if (location.store === "channel") editChannelList(location.key, edit);
    else if (location.store === "thread") editThreadList(location.key, edit);
    else editReactionList(location.key, edit);
  }
  const latestMessageTsMsByUser = (userId: UserId) =>
    findLatestMessageTsMsByUser(messagesByChannel, threadMessages, userId);
  const messagesInChannel = (channelId: ChannelId) => messagesByChannel[channelId];
  const messagesInThread = (threadTs: Ts) => threadMessages[threadTs];
  const reactionMessageFor = (channelId: ChannelId, ts: Ts) =>
    reactionMessages[reactionMessageKey(channelId, ts)]?.[0];
  function patchMessage(channelId: ChannelId, ts: Ts, patch: Partial<Message>) {
    if (patch.editedTs) history.recordLiveChange({ channelId, edit: patch, ts });
    for (const { location, list } of findAllMessageLocations(channelId, ts)) {
      const current = list.find((m) => m.ts === ts);
      if (!current) continue;
      const base = snapshot(current);
      const next = { ...base, ...patch, ...deps.extendPatch(base, patch) };
      editList(location, (messages) => {
        const target = messages.find((m) => m.ts === ts);
        if (target) reconcile(next, "id")(target);
      });
    }
  }
  function removeMessage(location: MessageLocation, ts: Ts) {
    editList(location, (messages) => {
      const idx = messages.findIndex((m) => m.ts === ts);
      if (idx !== -1) messages.splice(idx, 1);
    });
  }
  function markDeleted(channelId: ChannelId, ts: Ts) {
    deps.onMessageDeleted(channelId, ts);
    const locations = findAllMessageLocations(channelId, ts);
    const msg = locations[0]?.list.find((m) => m.ts === ts);
    if (msg && deps.retainsDeleted(msg)) patchMessage(channelId, ts, { deleted: true });
    else {
      history.forgetRemoved(channelId, ts);
      for (const { location } of locations) removeMessage(location, ts);
      dropThreadMessages(ts);
    }
  }
  const dismissMessage = (channelId: ChannelId, ts: Ts) => {
    for (const { location } of findAllMessageLocations(channelId, ts)) removeMessage(location, ts);
  };
  const { applyReactionEvent } = createReactionEvents({
    findAllMessageLocations,
    patchMessage,
    recordLiveChange: history.recordLiveChange,
  });
  const { reactToMessage } = createMessageReactionToggle({
    currentUser: deps.currentUser,
    findAllMessageLocations,
    patchMessage,
    recordLiveChange: history.recordLiveChange,
  });
  const { sendFiles, sendMessage } = createMessageSending({
    currentUser: deps.currentUser,
    patchMessage,
    removeMessage,
    editList,
  });
  const { broadcastThreadReply, deleteMessageAt, editMessageText } = createMessageMutations({
    currentUser: deps.currentUser,
    findAllMessageLocations,
    insertMessageInOrder: mergeActions.insertMessageInOrder,
    isChannelLoaded: (channelId) => loadedChannels.has(channelId),
    markDeleted,
    patchMessage,
  });
  const isMine = (msg: Message) => {
    const me = deps.currentUser();
    return me?.id === msg.userId || isMyRelayedMessage(msg, me);
  };
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
    hasEarlierReplies,
    hasEarlierRepliesError,
    isLoadingEarlierReplies,
    loadEarlierReplies,
    hasMoreReplies,
    hasMoreRepliesError,
    missingReplies,
    hasThreadError,
    isLoadingMoreReplies,
    loadMoreReplies,
    isLoadingHistory,
    isLoadingThread,
    isMine,
    acceptsLiveReplies,
    jumpToBeginning,
    jumpToDate,
    jumpToTs,
    latestMessageTsMsByUser,
    loadedChannels,
    markDeleted,
    loadOlderMessages,
    loadNewerMessages,
    loadRecentHistory,
    cacheReactionMessages,
    messagesByChannel,
    messagesInChannel,
    messagesInThread,
    prefetchHistory: history.prefetchHistory,
    patchMessage,
    reactionMessageFor,
    refreshThreadReplies,
    removeMessage,
    threadMessages,
    updateChannelMessages,
    updateThreadMessages,
    visibleThreads: deps.visibleThreads,
    broadcastThreadReply,
    deleteMessageAt,
    dismissMessage,
    editMessageText,
    reactToMessage,
    sendFiles,
    sendMessage,
    ...statusActions,
    realtimeHooks: {
      applyReactionEvent,
      insertMessageInOrder: mergeActions.insertMessageInOrder,
      mergeIncomingMessage: mergeActions.mergeIncomingMessage,
    },
  };
}
