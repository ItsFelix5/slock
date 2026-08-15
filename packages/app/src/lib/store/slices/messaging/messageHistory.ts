import type { ConversationViewData, Message } from "@slock/slack-api";
import {
  fetchChannelDetails,
  fetchHistory,
  fetchHistoryAround,
  fetchHistoryNewer,
} from "@slock/slack-api";
import { createEffect, untrack } from "solid-js";
import { createStore } from "solid-js/store";
import type { ChannelMessageTarget, ThreadRef, View } from "../types";
import { createRequestEpochs } from "./history/requestEpoch";
import { createHistoryJump } from "./historyJump";
import { mergeMessages } from "./merge/messageMerge";
import { createThreadReplies } from "./threadReplies";

type HistoryMeta = {
  anchored?: boolean;
  hasMore: boolean;
  hasNewer?: boolean;
  initialError?: boolean;
  loading: boolean;
  newerError?: boolean;
  olderError?: boolean;
};

type MessageHistoryApi = {
  fetchChannelDetails: typeof fetchChannelDetails;
  fetchHistory: typeof fetchHistory;
  fetchHistoryAround: typeof fetchHistoryAround;
  fetchHistoryNewer: typeof fetchHistoryNewer;
};

const DEFAULT_HISTORY_API: MessageHistoryApi = {
  fetchChannelDetails,
  fetchHistory,
  fetchHistoryAround,
  fetchHistoryNewer,
};

export function createMessageHistory(
  deps: {
    visibleMessageTargets: () => ChannelMessageTarget[];
    visibleViews: () => View[];
    visibleThreads: () => ThreadRef[];
    onConversationView?: (view: ConversationViewData) => void;
  },
  api: MessageHistoryApi = DEFAULT_HISTORY_API,
) {
  const [messagesByChannel, setMessagesByChannel] = createStore<Record<string, Message[]>>({});
  const loadedChannels = new Set<string>();
  const historyCursor = new Map<string, string | undefined>();
  const newerHistoryBoundary = new Map<string, string>();
  const [historyMeta, setHistoryMeta] = createStore<Record<string, HistoryMeta>>({});
  const windowEpochs = createRequestEpochs();
  const {
    ensureThreadRepliesLoaded,
    hasThreadError,
    isLoadingThread,
    loadedThreads,
    setThreadMessages,
    threadMessages,
  } = createThreadReplies({ visibleThreads: deps.visibleThreads });

  const [reactionMessages, setReactionMessages] = createStore<Record<string, Message[]>>({});
  async function loadRecentHistory(channelId: string) {
    const previous = historyMeta[channelId];
    const replaceAnchoredWindow = previous?.anchored === true;
    const previousHasMore = previous?.hasMore ?? true;
    const epoch = windowEpochs.begin(channelId);
    loadedChannels.add(channelId);
    setHistoryMeta(channelId, {
      anchored: replaceAnchoredWindow,
      hasMore: true,
      hasNewer: replaceAnchoredWindow,
      initialError: false,
      loading: true,
      newerError: false,
      olderError: false,
    });
    try {
      const { messages, hasMore, nextCursor, view } = await api.fetchHistory(channelId);
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      if (view) deps.onConversationView?.(view);
      setMessagesByChannel(channelId, (existing = []) =>
        mergeMessages(replaceAnchoredWindow ? [] : existing, messages),
      );
      historyCursor.set(channelId, nextCursor);
      newerHistoryBoundary.delete(channelId);
      setHistoryMeta(channelId, {
        anchored: false,
        hasMore,
        hasNewer: false,
        loading: false,
      });
    } catch (err) {
      console.error("Failed to load channel history", channelId, err);
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      if (!replaceAnchoredWindow) loadedChannels.delete(channelId);
      setHistoryMeta(channelId, {
        anchored: replaceAnchoredWindow,
        hasMore: previousHasMore,
        hasNewer: replaceAnchoredWindow,
        initialError: true,
        loading: false,
      });
    }
  }
  createEffect(() => {
    const targets = untrack(deps.visibleMessageTargets);
    for (const view of deps.visibleViews()) {
      if (targets.some((target) => target.channelId === view.id)) continue;

      const alreadyAtPresent =
        loadedChannels.has(view.id) && !untrack(() => historyMeta[view.id]?.anchored);
      if (alreadyAtPresent) continue;
      loadRecentHistory(view.id);
    }
  });
  function hasMoreHistory(channelId: string) {
    return historyMeta[channelId]?.hasMore ?? true;
  }
  function hasNewerHistory(channelId: string) {
    return historyMeta[channelId]?.hasNewer ?? historyMeta[channelId]?.anchored === true;
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
    const epoch = windowEpochs.current(channelId);
    setHistoryMeta(channelId, "loading", true);
    setHistoryMeta(channelId, "olderError", false);
    try {
      const { messages: older, hasMore, nextCursor } = await api.fetchHistory(channelId, cursor);
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      setMessagesByChannel(channelId, (existing = []) => mergeMessages(existing, older));
      historyCursor.set(channelId, nextCursor);
      setHistoryMeta(channelId, { hasMore, loading: false });
    } catch {
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      setHistoryMeta(channelId, "loading", false);
      setHistoryMeta(channelId, "olderError", true);
    }
  }
  async function loadNewerMessages(channelId: string) {
    if (!loadedChannels.has(channelId)) return;
    const meta = historyMeta[channelId];
    if (meta?.loading || meta?.hasNewer === false) return;
    const boundary =
      newerHistoryBoundary.get(channelId) ?? messagesByChannel[channelId]?.at(-1)?.ts;
    if (!boundary) {
      setHistoryMeta(channelId, { anchored: false, hasNewer: false });
      return;
    }

    const epoch = windowEpochs.current(channelId);
    setHistoryMeta(channelId, "loading", true);
    setHistoryMeta(channelId, "newerError", false);
    try {
      const {
        messages: newer,
        hasMore,
        nextOldest,
      } = await api.fetchHistoryNewer(channelId, boundary);
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      setMessagesByChannel(channelId, (existing = []) => mergeMessages(existing, newer));
      const nextBoundary = nextOldest ?? newer.at(-1)?.ts;
      if (nextBoundary) newerHistoryBoundary.set(channelId, nextBoundary);
      setHistoryMeta(channelId, {
        anchored: hasMore,
        hasNewer: hasMore,
        loading: false,
        newerError: false,
      });
    } catch {
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      setHistoryMeta(channelId, "loading", false);
      setHistoryMeta(channelId, "newerError", true);
    }
  }

  async function loadOlderMessagesThrough(
    channelId: string,
    oldestTimestampMs: number,
    maxPages: number,
  ) {
    if (!loadedChannels.has(channelId) || maxPages <= 0) return;
    const meta = historyMeta[channelId];
    if (meta?.loading || meta?.hasMore === false) return;
    let cursor = historyCursor.get(channelId);
    if (!cursor) {
      setHistoryMeta(channelId, "hasMore", false);
      return;
    }

    const epoch = windowEpochs.current(channelId);
    let hasMore = true;
    let olderMessages: Message[] = [];
    setHistoryMeta(channelId, "loading", true);
    setHistoryMeta(channelId, "olderError", false);
    try {
      for (let page = 0; page < maxPages && cursor; page += 1) {
        const {
          messages,
          hasMore: pageHasMore,
          nextCursor,
        } = await api.fetchHistory(channelId, cursor);
        if (!windowEpochs.isCurrent(channelId, epoch)) return;
        olderMessages = mergeMessages(olderMessages, messages);
        cursor = nextCursor;
        hasMore = pageHasMore;

        const [oldestLoaded] = olderMessages;
        const reachedTimestamp =
          oldestLoaded && parseFloat(oldestLoaded.ts) * 1000 <= oldestTimestampMs;
        if (reachedTimestamp || !hasMore) break;
      }

      setMessagesByChannel(channelId, (existing = []) => mergeMessages(existing, olderMessages));
      historyCursor.set(channelId, cursor);
      setHistoryMeta(channelId, { hasMore, loading: false });
    } catch {
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      setHistoryMeta(channelId, "loading", false);
      setHistoryMeta(channelId, "olderError", true);
    }
  }
  function hasHistoryError(channelId: string) {
    return historyMeta[channelId]?.initialError ?? false;
  }
  function hasOlderHistoryError(channelId: string) {
    return historyMeta[channelId]?.olderError ?? false;
  }
  function hasNewerHistoryError(channelId: string) {
    return historyMeta[channelId]?.newerError ?? false;
  }

  const { ensureChannelMessage, jumpToBeginning, jumpToDate } = createHistoryJump({
    api,
    historyCursor,
    historyMeta,
    loadedChannels,
    loadRecentHistory,
    messagesByChannel,
    newerHistoryBoundary,
    setHistoryMeta,
    setMessagesByChannel,
    windowEpochs,
  });
  return {
    ensureChannelMessage,
    ensureThreadRepliesLoaded,
    hasHistoryError,
    hasMoreHistory,
    hasNewerHistory,
    hasNewerHistoryError,
    hasOlderHistoryError,
    hasThreadError,
    historyCursor,
    historyMeta,
    isLoadingHistory,
    isLoadingThread,
    jumpToBeginning,
    jumpToDate,
    loadedChannels,
    loadedThreads,
    loadOlderMessages,
    loadOlderMessagesThrough,
    loadNewerMessages,
    loadRecentHistory,
    messagesByChannel,
    reactionMessages,
    setMessagesByChannel,
    setReactionMessages,
    setThreadMessages,
    threadMessages,
  };
}
