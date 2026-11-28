import type { ChannelMessageTarget, View } from "@slock/plugins/conversations/client/api/types";
import { compareTs, isChannelId, parseTs } from "@slock/slack";
import type { ChannelId, ConversationViewData, Message, Ts } from "@slock/types";
import { createStore } from "solid-js";
import type { ThreadRef } from "../api";
import { dropVanished, mergeMessages } from "../api/messageMerge";
import { createRecencyEviction } from "../lib/recencyEviction";
import { DEFAULT_HISTORY_API, type MessageHistoryApi } from "./history/historyApi";
import { createHistoryFlags, type HistoryMeta } from "./history/historyFlags";
import { newerSpanHint } from "./history/historyWindow";
import { createLiveChanges } from "./history/liveChanges";
import { createRemovedMessages } from "./history/removedMessages";
import { createRequestEpochs } from "./history/requestEpoch";
import { loadNewlyVisible } from "./history/visibleLoads";
import { createWindowMerges } from "./history/windowMerges";
import { createHistoryJump } from "./historyJump";
import { ensureMessageList, replaceMessageList, updateMessageList } from "./storeWrites";
import { createThreadReplies } from "./threadReplies";

const KEEP_RECENT_CHANNELS = 30;
const MAX_CACHED_REACTION_MESSAGES = 200;

export function createMessageHistory(
  deps: {
    visibleMessageTargets: () => ChannelMessageTarget[];
    visibleViews: () => View[];
    visibleThreads: () => ThreadRef[];
    onConversationView?: (view: ConversationViewData) => void;
    onHistoryLoaded?: (channelId: ChannelId, pinCount: number | undefined) => void;
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
    loadLatestReplies,
    loadMoreReplies,
    isLoadingThread,
    isThreadStale,
    acceptsLiveReplies,
    refreshThreadReplies,
    resyncThreads,
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
  const { mergeNewer, mergeOlder } = createWindowMerges({
    historyCursor,
    newerHistoryBoundary,
    patchMeta,
    replaceMessages,
  });
  function loadConversationMeta(channelId: ChannelId) {
    api
      .fetchConversationView(channelId)
      .then((view) => deps.onConversationView?.(view))
      .catch(() => {});
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
    const known = [...(messagesByChannel[channelId] ?? [])];
    const history = api.fetchHistory(channelId);
    loadConversationMeta(channelId);
    try {
      const { messages, hasMore, nextCursor, pinCount } = await history;
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      deps.onHistoryLoaded?.(channelId, pinCount);
      historyCursor.set(channelId, nextCursor);
      newerHistoryBoundary.delete(channelId);
      const oldest = messages[0]?.ts;
      const newestKnown = known.at(-1)?.ts;
      const detached = !!(oldest && newestKnown && compareTs(newestKnown, oldest) < 0);
      const covers = (ts: Ts) => !hasMore || detached || (!!oldest && compareTs(ts, oldest) >= 0);
      replaceMessages(channelId, (existing) =>
        mergeMessages(
          replaceAnchoredWindow ? [] : dropVanished(existing, known, messages, covers),
          messages,
        ),
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
  loadNewlyVisible({
    atPresent: (id) => loadedChannels.has(id) && !historyMeta[id]?.anchored,
    load: loadRecentHistory,
    visibleMessageTargets: deps.visibleMessageTargets,
    visibleViews: deps.visibleViews,
  });
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
      } = await api.fetchHistoryNewer(
        channelId,
        boundary,
        newerSpanHint(messagesByChannel[channelId]),
      );
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
    loadConversationMeta,
    loadRecentHistory,
    messagesByChannel,
    newerHistoryBoundary,
    onHistoryLoaded: deps.onHistoryLoaded,
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
    loadLatestReplies,
    loadMoreReplies,
    historyCursor,
    historyMeta,
    isLoadingThread,
    isThreadStale,
    acceptsLiveReplies,
    jumpToBeginning,
    jumpToDate,
    jumpToTs,
    loadedChannels,
    loadOlderMessages,
    loadNewerMessages,
    loadRecentHistory,
    messagesByChannel,
    reactionMessages,
    refreshThreadReplies,
    resyncThreads,
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
