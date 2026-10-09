import type { ConversationViewData, Message, User } from "@slock/types";
import { logDeletedMessages } from "@slock/ui";
import { produce, reconcile, unwrap } from "solid-js/store";
import {
  latestMessageTsMsByUser as findLatestMessageTsMsByUser,
  findMessageLocations,
  reactionMessageKey,
} from "../../../messageLocations";
import type { ChannelMessageTarget, MessageLocation, ThreadRef, View } from "../types";
import { createMessageMergeActions } from "./merge/messageMergeActions";
import { createMessageHistory } from "./messageHistory";
import { createMessageMutations } from "./messageMutations";
import { createMessageReactionToggle } from "./messageReactionToggle";
import { createMessageSending } from "./messageSending";
import { createMessageStatusActions } from "./messageStatusActions";
import { createReactionEvents } from "./reactionEvents";

export function createMessagesSlice(deps: {
  currentUser: () => User | undefined;
  clearChannelUnread: (channelId: string) => void;
  lastReadFor: (channelId: string) => number | undefined;
  unreadDividerTsFor: (channelId: string) => number | undefined;
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
  onMessageDeleted: (channelId: string, ts: string) => void;
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
    hasNewerHistory,
    messagesByChannel,
    patchMessage: (channelId, ts, patch) => patchMessage(channelId, ts, patch),
    lastReadFor: deps.lastReadFor,
    unreadDividerTsFor: deps.unreadDividerTsFor,
    setLastReadByChannel: deps.setLastReadByChannel,
    setChannelRead: deps.setChannelRead,
    setThreadRead: deps.setThreadRead,
    setUnreadChannelIds: deps.setUnreadChannelIds,
    setUnreadDividerTs: deps.setUnreadDividerTs,
    syncChannelRead: deps.syncChannelRead,
    threadMessages,
  });
  const mergeActions = createMessageMergeActions({
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
    if (patch.deleted) deps.onMessageDeleted(channelId, ts);
    for (const { location, list } of findAllMessageLocations(channelId, ts)) {
      const current = list.find((m) => m.ts === ts);
      if (!current) continue;
      const logEdit =
        logDeletedMessages() && patch.text !== undefined && patch.text !== current.text;
      setStore[location.store](
        location.key,
        (m) => m.ts === ts,
        reconcile({
          ...unwrap(current),
          ...patch,
          ...(logEdit && { editHistory: [...(current.editHistory ?? []), current.text] }),
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
    findAllMessageLocations,
    patchMessage,
  });
  const { isReactionPending, reactToMessage } = createMessageReactionToggle({
    currentUser: deps.currentUser,
    findAllMessageLocations,
    patchMessage,
  });
  const { sendFiles, sendMessage } = createMessageSending({
    currentUser: deps.currentUser,
    patchMessage,
    removeMessage,
    setChannelMessages: setMessagesByChannel,
    setThreadMessages,
  });
  const { broadcastThreadReply, deleteMessageAt, editMessageText } = createMessageMutations({
    currentUser: deps.currentUser,
    findAllMessageLocations,
    insertMessageInOrder: mergeActions.insertMessageInOrder,
    isChannelLoaded: (channelId) => loadedChannels.has(channelId),
    patchMessage,
  });
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
