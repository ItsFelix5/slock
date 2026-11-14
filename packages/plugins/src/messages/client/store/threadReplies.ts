import type { Message } from "@slock/types";
import { createKeyedAsyncCache, createRecencyEviction } from "@slock/ui";
import { createEffect, untrack } from "solid-js";
import { createStore, produce } from "solid-js/store";
import {
  fetchReplies,
  fetchRepliesBefore,
  fetchRepliesFrom,
  fetchThreadRoot,
} from "../../../slack/client/api";
import type { ThreadRef } from "../api";
import { mergeMessages } from "../api/messageMerge";

const KEEP_RECENT_THREADS = 3;

type ThreadPaging = {
  after?: string;
  before?: string;
  earlierError: boolean;
  earlierLoading: boolean;
  error: boolean;
  hasEarlier: boolean;
  hasMore: boolean;
  loading: boolean;
  span?: number;
};

type ThreadApi = {
  fetchReplies: typeof fetchReplies;
  fetchRepliesBefore: typeof fetchRepliesBefore;
  fetchRepliesFrom: typeof fetchRepliesFrom;
  fetchThreadRoot: typeof fetchThreadRoot;
};

const idle = { earlierError: false, earlierLoading: false, error: false, loading: false };

export function createThreadReplies(
  deps: { visibleThreads: () => ThreadRef[] },
  api: ThreadApi = { fetchReplies, fetchRepliesBefore, fetchRepliesFrom, fetchThreadRoot },
) {
  const channelForThread = new Map<string, string>();
  const anchorForThread = new Map<string, string>();
  const anchorAttempted = new Map<string, string>();
  const [paging, setPaging] = createStore<Record<string, ThreadPaging>>({});

  async function loadAnchored(channelId: string, ts: string, anchor: string): Promise<Message[]> {
    anchorAttempted.set(ts, anchor);
    const [root, forward, earlier] = await Promise.all([
      api.fetchThreadRoot(channelId, ts),
      api.fetchRepliesFrom(channelId, ts, anchor),
      api.fetchRepliesBefore(channelId, ts, anchor),
    ]);
    setPaging(ts, {
      ...idle,
      after: forward.edge,
      before: earlier.before,
      hasEarlier: earlier.hasEarlier,
      hasMore: forward.hasMore,
      span: earlier.span,
    });
    return mergeMessages([], [...(root ? [root] : []), ...earlier.messages, ...forward.messages]);
  }

  async function loadFirst(channelId: string, ts: string, existing: Message[] = []) {
    const page = await api.fetchReplies(channelId, ts);
    setPaging(ts, {
      ...idle,
      after: page.edge,
      before: undefined,
      hasEarlier: false,
      hasMore: page.hasMore,
    });
    return mergeMessages(existing, page.messages);
  }

  async function catchUp(channelId: string, ts: string, after: string, existing: Message[] = []) {
    const page = await api.fetchRepliesFrom(channelId, ts, after);
    setPaging(ts, { after: page.edge ?? after, hasMore: page.hasMore });
    return mergeMessages(existing, page.messages);
  }

  const cache = createKeyedAsyncCache<Message[]>(
    (ts): Promise<Message[]> => {
      const channelId = channelForThread.get(ts);
      if (!channelId) return Promise.resolve([]);
      const anchor = anchorForThread.get(ts);
      anchorForThread.delete(ts);
      if (anchor) return loadAnchored(channelId, ts, anchor);
      const after = paging[ts]?.after;
      return after
        ? catchUp(channelId, ts, after, cache.entry(ts))
        : loadFirst(channelId, ts, cache.entry(ts));
    },
    { onError: (err, ts) => console.error("Failed to load thread", ts, err) },
  );

  function coversAnchor(ts: string, anchor: string): boolean {
    const state = paging[ts];
    if (!state) return false;
    const lower = state.hasEarlier ? Number(state.before) : Number(ts);
    const upper = state.hasMore ? Number(state.after) : Number.POSITIVE_INFINITY;
    return Number(anchor) >= lower && Number(anchor) <= upper;
  }

  function ensureThreadRepliesLoaded(channelId: string, ts: string, anchor?: string): void {
    channelForThread.set(ts, channelId);
    if (
      anchor &&
      anchor !== ts &&
      anchorAttempted.get(ts) !== anchor &&
      !coversAnchor(ts, anchor)
    ) {
      anchorForThread.set(ts, anchor);
      void cache.refresh(ts);
      return;
    }
    if (!(paging[ts] || cache.hasError(ts))) void cache.refresh(ts);
  }
  createEffect(() => {
    for (const thread of deps.visibleThreads())
      untrack(() => ensureThreadRepliesLoaded(thread.channelId, thread.ts, thread.highlightTs));
  });

  async function loadMoreReplies(ts: string) {
    const channelId = channelForThread.get(ts);
    const state = paging[ts];
    if (!(channelId && state?.hasMore && state.after) || state.loading) return;
    setPaging(ts, { error: false, loading: true });
    try {
      const page = await api.fetchReplies(channelId, ts, state.after);
      if (!paging[ts]) return;
      cache.update(ts, (existing) => mergeMessages(existing ?? [], page.messages));
      setPaging(ts, {
        after: page.edge ?? state.after,
        hasMore: page.hasMore && page.edge !== undefined && page.edge !== state.after,
        loading: false,
      });
    } catch (err) {
      console.error("Failed to load more replies", ts, err);
      if (paging[ts]) setPaging(ts, { error: true, loading: false });
    }
  }

  async function loadEarlierReplies(ts: string) {
    const channelId = channelForThread.get(ts);
    const state = paging[ts];
    if (!(channelId && state?.hasEarlier && state.before) || state.earlierLoading) return;
    setPaging(ts, { earlierError: false, earlierLoading: true });
    try {
      const page = await api.fetchRepliesBefore(channelId, ts, state.before, state.span);
      if (!paging[ts]) return;
      cache.update(ts, (existing) => mergeMessages(existing ?? [], page.messages));
      setPaging(ts, {
        before: page.before,
        earlierLoading: false,
        hasEarlier: page.hasEarlier && page.before !== state.before,
        span: page.span,
      });
    } catch (err) {
      console.error("Failed to load earlier replies", ts, err);
      if (paging[ts]) setPaging(ts, { earlierError: true, earlierLoading: false });
    }
  }

  createRecencyEviction({
    evict: (ts) => {
      if (cache.entry(ts)?.some((m) => m.deleted)) return;
      cache.invalidate(ts);
      channelForThread.delete(ts);
      anchorForThread.delete(ts);
      anchorAttempted.delete(ts);
      setPaging(produce((s) => delete s[ts]));
    },
    keepRecent: KEEP_RECENT_THREADS,
    visible: () => deps.visibleThreads().map((thread) => thread.ts),
  });

  return {
    acceptsLiveReplies: (ts: string) => cache.isKnown(ts) && !paging[ts]?.hasMore,
    ensureThreadRepliesLoaded,
    hasEarlierReplies: (ts: string) => paging[ts]?.hasEarlier ?? false,
    hasEarlierRepliesError: (ts: string) => paging[ts]?.earlierError ?? false,
    hasMoreReplies: (ts: string) => paging[ts]?.hasMore ?? false,
    hasMoreRepliesError: (ts: string) => paging[ts]?.error ?? false,
    hasThreadError: cache.hasError,
    isLoadingEarlierReplies: (ts: string) => paging[ts]?.earlierLoading ?? false,
    isLoadingMoreReplies: (ts: string) => paging[ts]?.loading ?? false,
    isLoadingThread: cache.isLoading,
    loadEarlierReplies,
    loadMoreReplies,
    refreshThreadReplies: cache.refresh,
    setThreadMessages: cache.setStore,
    threadMessages: cache.store,
  };
}
