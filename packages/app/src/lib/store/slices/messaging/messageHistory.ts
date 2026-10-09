import type { ConversationViewData, Message } from "@slock/types";
import { createRecencyEviction } from "@slock/ui";
import { createEffect, untrack } from "solid-js";
import { createStore, produce } from "solid-js/store";
import {
  fetchChannelDetails,
  fetchHistory,
  fetchHistoryAround,
  fetchHistoryNewer,
} from "../../../api";
import { mergeMessages } from "../../../messageMerge";
import type { ChannelMessageTarget, ThreadRef, View } from "../types";
import { createRequestEpochs } from "./history/requestEpoch";
import { createHistoryJump, type HistoryMeta } from "./historyJump";
import { createThreadReplies } from "./threadReplies";

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

const MAX_LOADED_MESSAGES = 300;
const KEEP_RECENT_CHANNELS = 3;

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
    isThreadKnown,
    refreshThreadReplies,
    setThreadMessages,
    threadMessages,
  } = createThreadReplies({ visibleThreads: deps.visibleThreads });

  const [reactionMessages, setReactionMessages] = createStore<Record<string, Message[]>>({});
  function mergeOlder(channelId: string, older: Message[]) {
    let cut = false;
    setMessagesByChannel(channelId, (existing = []) => {
      const merged = mergeMessages(existing, older);
      cut = merged.length > MAX_LOADED_MESSAGES;
      return merged.slice(0, MAX_LOADED_MESSAGES);
    });
    if (!cut) return;
    newerHistoryBoundary.set(channelId, messagesByChannel[channelId].at(-1)?.ts ?? "");
    setHistoryMeta(channelId, { anchored: true, hasNewer: true });
  }
  function mergeNewer(channelId: string, newer: Message[]) {
    let cut = false;
    setMessagesByChannel(channelId, (existing = []) => {
      const merged = mergeMessages(existing, newer);
      cut = merged.length > MAX_LOADED_MESSAGES;
      return merged.slice(-MAX_LOADED_MESSAGES);
    });
    if (!cut) return;
    historyCursor.set(channelId, `before:${messagesByChannel[channelId][0].ts}`);
    setHistoryMeta(channelId, "hasMore", true);
  }
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
  function evictChannel(channelId: string) {
    windowEpochs.begin(channelId);
    loadedChannels.delete(channelId);
    historyCursor.delete(channelId);
    newerHistoryBoundary.delete(channelId);
    setMessagesByChannel(produce((s) => delete s[channelId]));
    setHistoryMeta(produce((s) => delete s[channelId]));
  }
  createRecencyEviction({
    evict: evictChannel,
    keepRecent: KEEP_RECENT_CHANNELS,
    visible: () => deps.visibleViews().map((view) => view.id),
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
      mergeOlder(channelId, older);
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
      const { messages: newer, hasMore } = await api.fetchHistoryNewer(channelId, boundary);
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      mergeNewer(channelId, newer);
      if (hasMore) newerHistoryBoundary.set(channelId, newer.at(-1)?.ts ?? boundary);
      else newerHistoryBoundary.delete(channelId);
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
    isThreadKnown,
    jumpToBeginning,
    jumpToDate,
    loadedChannels,
    loadOlderMessages,
    loadNewerMessages,
    loadRecentHistory,
    messagesByChannel,
    reactionMessages,
    refreshThreadReplies,
    setMessagesByChannel,
    setReactionMessages,
    setThreadMessages,
    threadMessages,
  };
}
