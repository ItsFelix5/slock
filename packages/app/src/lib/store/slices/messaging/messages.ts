import { produce } from "solid-js/store";
import type { ActivityItem, ConversationViewData, Message, User } from "../../../api";
import {
  broadcastReply,
  deleteMessage,
  editMessage,
  postBroadcastMessage,
  postMessage,
} from "../../../api";
import { actionFeedback } from "../../../feedback";
import { findMessageLocations, reactionMessageKey } from "../../../messageLocations";
import { dedupeMessages } from "../../../messageMerge";
import { undoStack } from "../../../undo";
import type { ChannelMessageTarget, MessageLocation, ThreadRef, View } from "../types";
import { createMessageMergeActions } from "./merge/messageMergeActions";
import { createMessageHistory } from "./messageHistory";
import { createMessageReactionToggle } from "./messageReactionToggle";
import { createMessageStatusActions } from "./messageStatusActions";
import { createReactionEvents } from "./reactionEvents";

const BROADCAST_MENTION_RE = /(?<![<!\w])@(channel|here)\b/gi;

function withBroadcastMentions(text: string): { text: string; hasBroadcast: boolean } {
  let hasBroadcast = false;
  const converted = text.replace(BROADCAST_MENTION_RE, (_match, kind: string) => {
    hasBroadcast = true;
    return `<!${kind.toLowerCase()}>`;
  });
  return { hasBroadcast, text: converted };
}

export function createMessagesSlice(deps: {
  currentUser: () => User | undefined;
  pushActivity: (item: ActivityItem) => void;
  clearChannelUnread: (channelId: string) => void;
  setLastReadByChannel: (channelId: string, ts: number) => void;
  setUnreadDividerTs: (channelId: string, ts: number) => void;
  setUnreadChannelIds: (channelId: string, unread: boolean) => void;
  setChannelRead: (channelId: string, ts: string) => Promise<boolean>;
  syncChannelRead: (channelId: string, ts: string) => Promise<boolean>;
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
    jumpToBeginning,
    jumpToDate,
  } = history;
  const statusActions = createMessageStatusActions({
    clearChannelUnread: deps.clearChannelUnread,
    hasMoreHistory,
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
  const { isReactionPending, reactToMessage } = createMessageReactionToggle({
    currentUser: deps.currentUser,
    findAllMessageLocations,
    patchMessage,
  });
  async function sendMessage(
    channelId: string,
    text: string,
    threadTs?: string,
    blocks?: unknown,
    suppressUnfurl?: boolean,
  ) {
    const trimmed = text.trim();
    if (!(trimmed || blocks)) return;
    const { text: withBroadcast, hasBroadcast } = withBroadcastMentions(trimmed);
    const me = deps.currentUser();
    const now = Date.now();
    const optimistic: Message = {
      blocks: blocks as Message["blocks"],
      day: "Today",
      id: `pending-${now}`,
      kind: "normal",
      text: withBroadcast,
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
        ? await postBroadcastMessage(channelId, withBroadcast, threadTs, blocks, suppressUnfurl)
        : await postMessage(channelId, trimmed, threadTs, blocks, suppressUnfurl);
      const realTs = res.ts as string;

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
  async function editMessageText(channelId: string, ts: string, text: string, blocks?: unknown) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const previous = findAllMessageLocations(channelId, ts)[0]?.list.find((m) => m.ts === ts);
    try {
      await editMessage(channelId, ts, trimmed, blocks);
      patchMessage(channelId, ts, {
        blocks: blocks as Message["blocks"],
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
    jumpToBeginning,
    jumpToDate,
    loadedChannels,
    loadedThreads,
    loadOlderMessages,
    loadOlderMessagesThrough,
    loadNewerMessages,
    loadRecentHistory,
    messagesByChannel,
    messagesInChannel,
    messagesInThread,
    patchMessage,
    reactionMessageFor,
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
