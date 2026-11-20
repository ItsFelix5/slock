import { isChannelId, parseTs } from "@slock/slack";
import type { ChannelId, ConversationViewData, Message, Ts } from "@slock/types";
import { createRecencyEviction } from "@slock/ui";
import { createEffect, createStore, untrack } from "solid-js";
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
import { replaceMessageList, updateMessageList } from "./storeWrites";
import { createThreadReplies } from "./threadReplies";

export type MessageHistoryApi = {
  fetchChannelDetails: (channelId: ChannelId) => ReturnType<typeof fetchChannelDetails>;
  fetchConversationView: (channelId: ChannelId) => ReturnType<typeof fetchConversationView>;
  fetchHistory: (channelId: ChannelId, cursor?: string) => ReturnType<typeof fetchHistory>;
  fetchHistoryAround: (channelId: ChannelId, ts: Ts) => ReturnType<typeof fetchHistoryAround>;
  fetchHistoryNewer: (channelId: ChannelId, oldest: Ts) => ReturnType<typeof fetchHistoryNewer>;
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
  const [messagesByChannel, setMessagesByChannel] = createStore<Record<ChannelId, Message[]>>({});
  const removed = createRemovedMessages();
  const updateChannelMessages = (
    channelId: ChannelId,
    compute: (existing: Message[]) => Message[],
  ) => setMessagesByChannel((s) => updateMessageList(s, channelId, compute));
  function replaceMessages(channelId: ChannelId, compute: (existing: Message[]) => Message[]) {
    let result: Message[] = [];
    setMessagesByChannel((s) => {
      result = removed.without(channelId, compute(s[channelId] ?? []));
      replaceMessageList(s, channelId, result);
    });
    return result;
  }
  const loadedChannels = new Set<ChannelId>();
  const historyPrefetch = createHistoryPrefetch(api, (channelId) => loadedChannels.has(channelId));
  const historyCursor = new Map<ChannelId, string | undefined>();
  const newerHistoryBoundary = new Map<ChannelId, Ts>();
  const [historyMeta, setHistoryMeta] = createStore<Record<ChannelId, HistoryMeta>>({});
  const patchMeta = (channelId: ChannelId, patch: Partial<HistoryMeta>) =>
    setHistoryMeta((s) => {
      const meta = s[channelId];
      if (meta) Object.assign(meta, patch);
      else s[channelId] = { hasMore: true, loading: false, ...patch };
    });
  const windowEpochs = createRequestEpochs<ChannelId>();
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

  const updateThreadMessages = (threadTs: Ts, compute: (existing: Message[]) => Message[]) =>
    setThreadMessages((s) => updateMessageList(s, threadTs, compute));
  const [reactionMessages, setReactionMessages] = createStore<Record<string, Message[]>>({});
  function mergeOlder(channelId: ChannelId, older: Message[]) {
    let cut = false;
    const kept = replaceMessages(channelId, (existing) => {
      const merged = mergeMessages(existing, older);
      cut = merged.length > MAX_LOADED_MESSAGES;
      return merged.slice(0, MAX_LOADED_MESSAGES);
    });
    const newest = kept.at(-1);
    if (!(cut && newest)) return;
    newerHistoryBoundary.set(channelId, newest.ts);
    patchMeta(channelId, { anchored: true, hasNewer: true });
  }
  function mergeNewer(channelId: ChannelId, newer: Message[]) {
    let cut = false;
    const kept = replaceMessages(channelId, (existing) => {
      const merged = mergeMessages(existing, newer);
      cut = merged.length > MAX_LOADED_MESSAGES;
      return merged.slice(-MAX_LOADED_MESSAGES);
    });
    const oldest = kept[0];
    if (!(cut && oldest)) return;
    historyCursor.set(channelId, `before:${oldest.ts}`);
    patchMeta(channelId, { hasMore: true });
  }
  async function loadRecentHistory(channelId: ChannelId) {
    const previous = historyMeta[channelId];
    const replaceAnchoredWindow = previous?.anchored === true;
    const previousHasMore = previous?.hasMore ?? true;
    const epoch = windowEpochs.begin(channelId);
    loadedChannels.add(channelId);
    patchMeta(channelId, {
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
      replaceMessages(channelId, (existing) =>
        mergeMessages(replaceAnchoredWindow ? [] : existing, messages),
      );
      patchMeta(channelId, { anchored: false, hasMore, hasNewer: false, loading: false });
    } catch (err) {
      console.error("Failed to load channel history", channelId, err);
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      patchMeta(channelId, {
        anchored: replaceAnchoredWindow,
        hasMore: previousHasMore,
        hasNewer: replaceAnchoredWindow,
        initialError: true,
        loading: false,
      });
    }
  }
  createEffect(
    () => deps.visibleViews(),
    (views) => {
      untrack(() => {
        const targets = deps.visibleMessageTargets();
        for (const view of views) {
          if (targets.some((target) => target.channelId === view.id)) continue;
          const alreadyAtPresent = loadedChannels.has(view.id) && !historyMeta[view.id]?.anchored;
          if (alreadyAtPresent) continue;
          void loadRecentHistory(view.id);
        }
      });
    },
  );
  function evictChannel(channelId: ChannelId) {
    windowEpochs.begin(channelId);
    loadedChannels.delete(channelId);
    removed.clear(channelId);
    historyCursor.delete(channelId);
    newerHistoryBoundary.delete(channelId);
    setMessagesByChannel((s) => {
      delete s[channelId];
    });
    setHistoryMeta((s) => {
      delete s[channelId];
    });
  }
  createRecencyEviction({
    evict: (key) => {
      if (isChannelId(key)) evictChannel(key);
    },
    keepRecent: KEEP_RECENT_CHANNELS,
    visible: () => deps.visibleViews().map((view) => view.id),
  });
  async function loadOlderMessages(channelId: ChannelId) {
    if (!loadedChannels.has(channelId)) return;
    const meta = historyMeta[channelId];
    if (meta?.loading || meta?.hasMore === false) return;
    const cursor = historyCursor.get(channelId);
    if (!cursor) {
      patchMeta(channelId, { hasMore: false });
      return;
    }
    const epoch = windowEpochs.current(channelId);
    patchMeta(channelId, { loading: true, olderError: false });
    try {
      const { messages: older, hasMore, nextCursor } = await api.fetchHistory(channelId, cursor);
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      historyCursor.set(channelId, nextCursor);
      mergeOlder(channelId, older);
      patchMeta(channelId, { hasMore, loading: false });
    } catch {
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      patchMeta(channelId, { loading: false, olderError: true });
    }
  }
  async function loadNewerMessages(channelId: ChannelId) {
    if (!loadedChannels.has(channelId)) return;
    const meta = historyMeta[channelId];
    if (meta?.loading || meta?.hasNewer === false) return;
    const boundary =
      newerHistoryBoundary.get(channelId) ?? messagesByChannel[channelId]?.at(-1)?.ts;
    if (!boundary) {
      patchMeta(channelId, { anchored: false, hasNewer: false });
      return;
    }

    const epoch = windowEpochs.current(channelId);
    patchMeta(channelId, { loading: true, newerError: false });
    try {
      const {
        messages: newer,
        hasMore,
        nextCursor,
      } = await api.fetchHistoryNewer(channelId, boundary);
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      if (hasMore && nextCursor) newerHistoryBoundary.set(channelId, parseTs(nextCursor));
      else newerHistoryBoundary.delete(channelId);
      mergeNewer(channelId, newer);
      patchMeta(
        channelId,
        hasMore
          ? { loading: false, newerError: false }
          : { anchored: false, hasNewer: false, loading: false },
      );
    } catch {
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      patchMeta(channelId, { loading: false, newerError: true });
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
    patchMeta,
    replaceMessages,
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
    updateChannelMessages,
    updateThreadMessages,
  };
}
