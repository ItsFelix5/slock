import type { ChannelMessageTarget, View } from "@slock/plugins/conversations/client/api/types";
import { isChannelId, parseTs } from "@slock/slack";
import type { ChannelId, ConversationViewData, Message, Ts } from "@slock/types";
import { createRecencyEviction } from "@slock/ui";
import { createEffect, createStore, untrack } from "solid-js";
import type { ThreadRef } from "../api";
import { mergeMessages } from "../api/messageMerge";
import { DEFAULT_HISTORY_API, type MessageHistoryApi } from "./history/historyApi";
import { createHistoryFlags, type HistoryMeta } from "./history/historyFlags";
import { createHistoryPrefetch } from "./history/historyPrefetch";
import { mergeNewerWindow, mergeOlderWindow } from "./history/historyWindow";
import { createLiveChanges } from "./history/liveChanges";
import { channelsNeedingRecentHistory } from "./history/loadPlan";
import { createRemovedMessages } from "./history/removedMessages";
import { createRequestEpochs } from "./history/requestEpoch";
import { createHistoryJump } from "./historyJump";
import { ensureMessageList, replaceMessageList, updateMessageList } from "./storeWrites";
import { createThreadReplies } from "./threadReplies";

const KEEP_RECENT_CHANNELS = 8;
const MAX_CACHED_REACTION_MESSAGES = 200;

export function createMessageHistory(
  deps: {
    visibleMessageTargets: () => ChannelMessageTarget[];
    visibleViews: () => View[];
    visibleThreads: () => ThreadRef[];
    onConversationView?: (view: ConversationViewData) => void;
  },
  rawApi: MessageHistoryApi = DEFAULT_HISTORY_API,
) {
  const liveChanges = createLiveChanges();
  const api = liveChanges.guard(rawApi);
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
    dropThreadMessages,
    editThreadList,
    threadMessages,
    updateThreadMessages,
  } = createThreadReplies({ visibleThreads: deps.visibleThreads });

  const [reactionMessages, setReactionMessages] = createStore<Record<string, Message[]>>({});
  const editChannelList = (channelId: ChannelId, edit: (list: Message[]) => void) =>
    setMessagesByChannel((s) => edit(ensureMessageList(s, channelId)));
  const editReactionList = (key: string, edit: (list: Message[]) => void) =>
    setReactionMessages((s) => edit(ensureMessageList(s, key)));
  const cacheReactionMessages = (resolved: Map<string, Message>) =>
    setReactionMessages((cached) => {
      for (const [key, message] of resolved) cached[key] = [message];
      const keys = Object.keys(cached);
      for (const key of keys.slice(0, Math.max(0, keys.length - MAX_CACHED_REACTION_MESSAGES)))
        delete cached[key];
    });
  function mergeOlder(channelId: ChannelId, older: Message[]) {
    let cut = false;
    const kept = replaceMessages(channelId, (existing) => {
      const { cut: trimmed, list } = mergeOlderWindow(existing, older);
      cut = trimmed;
      return list;
    });
    const newest = kept.at(-1);
    if (!(cut && newest)) return;
    newerHistoryBoundary.set(channelId, newest.ts);
    patchMeta(channelId, { anchored: true, hasNewer: true });
  }
  function mergeNewer(channelId: ChannelId, newer: Message[]) {
    let cut = false;
    const kept = replaceMessages(channelId, (existing) => {
      const { cut: trimmed, list } = mergeNewerWindow(existing, newer);
      cut = trimmed;
      return list;
    });
    const [oldest] = kept;
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
        const toLoad = channelsNeedingRecentHistory({
          atPresent: (id) => loadedChannels.has(id) && !historyMeta[id]?.anchored,
          targetChannelIds: deps.visibleMessageTargets().map((target) => target.channelId),
          viewIds: views.map((view) => view.id),
        });
        for (const id of toLoad) void loadRecentHistory(id);
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
    recordLiveChange: liveChanges.record,
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
    cacheReactionMessages,
    dropThreadMessages,
    editChannelList,
    editReactionList,
    editThreadList,
    threadMessages,
    updateChannelMessages,
    updateThreadMessages,
  };
}
