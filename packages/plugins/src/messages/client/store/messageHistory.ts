import { defined } from "@slock/core";
import type { ConversationViewData, Message } from "@slock/types";
import { createRecencyEviction } from "@slock/ui";
import { batch, createEffect, untrack } from "solid-js";
import { createStore, produce, reconcile } from "solid-js";
import type { ChannelMessageTarget, View } from "../../../conversations/client/api/types";
import {
  fetchChannelDetails,
  fetchConversationView,
  fetchHistory,
  fetchHistoryAround,
  fetchHistoryNewer,
} from "../../../slack/client/api";
import type { ThreadRef } from "../api";
import { mergeMessages } from "../api/messageMerge";
import { createHistoryFlags, type HistoryMeta } from "./history/historyFlags";
import { createHistoryPrefetch } from "./history/historyPrefetch";
import { createRemovedMessages } from "./history/removedMessages";
import { createRequestEpochs } from "./history/requestEpoch";
import { createHistoryJump } from "./historyJump";
import { createThreadReplies } from "./threadReplies";

type MessageHistoryApi = {
  fetchChannelDetails: typeof fetchChannelDetails;
  fetchConversationView: typeof fetchConversationView;
  fetchHistory: typeof fetchHistory;
  fetchHistoryAround: typeof fetchHistoryAround;
  fetchHistoryNewer: typeof fetchHistoryNewer;
};

const DEFAULT_HISTORY_API: MessageHistoryApi = {
  fetchChannelDetails,
  fetchConversationView,
  fetchHistory,
  fetchHistoryAround,
  fetchHistoryNewer,
};

const MAX_LOADED_MESSAGES = 120;
const KEEP_RECENT_CHANNELS = 8;

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
  const removed = createRemovedMessages();
  const replaceMessages = (channelId: string, compute: (existing: Message[]) => Message[]) =>
    setMessagesByChannel(
      channelId,
      reconcile(removed.without(channelId, compute(messagesByChannel[channelId] ?? [])), {
        key: "id",
      }),
    );
  const loadedChannels = new Set<string>();
  const historyPrefetch = createHistoryPrefetch(api, (channelId) => loadedChannels.has(channelId));
  const historyCursor = new Map<string, string | undefined>();
  const newerHistoryBoundary = new Map<string, string>();
  const [historyMeta, setHistoryMeta] = createStore<Record<string, HistoryMeta>>({});
  const windowEpochs = createRequestEpochs();
  const flags = createHistoryFlags(historyMeta);
  const {
    ensureThreadRepliesLoaded,
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
    isLoadingThread,
    acceptsLiveReplies,
    refreshThreadReplies,
    setThreadMessages,
    threadMessages,
  } = createThreadReplies({ visibleThreads: deps.visibleThreads });

  const [reactionMessages, setReactionMessages] = createStore<Record<string, Message[]>>({});
  function mergeOlder(channelId: string, older: Message[]) {
    let cut = false;
    replaceMessages(channelId, (existing) => {
      const merged = mergeMessages(existing, older);
      cut = merged.length > MAX_LOADED_MESSAGES;
      return merged.slice(0, MAX_LOADED_MESSAGES);
    });
    if (!cut) return;
    newerHistoryBoundary.set(channelId, defined(messagesByChannel[channelId]).at(-1)?.ts ?? "");
    setHistoryMeta(channelId, { anchored: true, hasNewer: true });
  }
  function mergeNewer(channelId: string, newer: Message[]) {
    let cut = false;
    replaceMessages(channelId, (existing) => {
      const merged = mergeMessages(existing, newer);
      cut = merged.length > MAX_LOADED_MESSAGES;
      return merged.slice(-MAX_LOADED_MESSAGES);
    });
    if (!cut) return;
    historyCursor.set(channelId, `before:${defined(defined(messagesByChannel[channelId])[0]).ts}`);
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
    const source = historyPrefetch.take(channelId);
    source.view.then((view) => deps.onConversationView?.(view)).catch(() => {});
    try {
      const { messages, hasMore, nextCursor } = await source.history;
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      historyCursor.set(channelId, nextCursor);
      newerHistoryBoundary.delete(channelId);
      batch(() => {
        replaceMessages(channelId, (existing) =>
          mergeMessages(replaceAnchoredWindow ? [] : existing, messages),
        );
        setHistoryMeta(channelId, {
          anchored: false,
          hasMore,
          hasNewer: false,
          loading: false,
        });
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
      untrack(() => loadRecentHistory(view.id));
    }
  });
  function evictChannel(channelId: string) {
    windowEpochs.begin(channelId);
    loadedChannels.delete(channelId);
    removed.clear(channelId);
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
      historyCursor.set(channelId, nextCursor);
      batch(() => {
        mergeOlder(channelId, older);
        setHistoryMeta(channelId, { hasMore, loading: false });
      });
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
        nextCursor,
      } = await api.fetchHistoryNewer(channelId, boundary);
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      if (hasMore) newerHistoryBoundary.set(channelId, defined(nextCursor));
      else newerHistoryBoundary.delete(channelId);
      batch(() => {
        mergeNewer(channelId, newer);
        setHistoryMeta(
          channelId,
          hasMore
            ? { loading: false, newerError: false }
            : { anchored: false, hasNewer: false, loading: false },
        );
      });
    } catch {
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      setHistoryMeta(channelId, "loading", false);
      setHistoryMeta(channelId, "newerError", true);
    }
  }

  const { ensureChannelMessage, jumpToBeginning, jumpToDate, jumpToTs } = createHistoryJump({
    api,
    historyCursor,
    historyMeta,
    loadedChannels,
    loadNewerMessages,
    loadRecentHistory,
    messagesByChannel,
    newerHistoryBoundary,
    replaceMessages,
    setHistoryMeta,
    windowEpochs,
  });
  return {
    ensureChannelMessage,
    ensureThreadRepliesLoaded,
    ...flags,
    forgetRemoved: removed.forget,
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
    historyCursor,
    historyMeta,
    isLoadingThread,
    acceptsLiveReplies,
    jumpToBeginning,
    jumpToDate,
    jumpToTs,
    loadedChannels,
    loadOlderMessages,
    loadNewerMessages,
    loadRecentHistory,
    prefetchHistory: historyPrefetch.prefetch,
    messagesByChannel,
    reactionMessages,
    refreshThreadReplies,
    setMessagesByChannel,
    setReactionMessages,
    setThreadMessages,
    threadMessages,
  };
}
