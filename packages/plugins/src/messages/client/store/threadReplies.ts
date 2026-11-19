import type { Message } from "@slock/types";
import { createKeyedAsyncCache, createRecencyEviction } from "@slock/ui";
import { createEffect, untrack } from "solid-js";
import { createStore, produce } from "solid-js";
import {
  fetchReplies,
  fetchRepliesBefore,
  fetchRepliesFrom,
  fetchThreadRoot,
} from "../../../slack/client/api";
import type { ThreadRef } from "../api";
import { mergeMessages } from "../api/messageMerge";

const KEEP_RECENT_THREADS = 8;

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

  let lastRun = 0;
  const runs = new Map<string, number>();
  const startRun = (ts: string) => {
    runs.set(ts, ++lastRun);
    return lastRun;
  };
  const isRun = (ts: string, run: number | undefined) => run !== undefined && runs.get(ts) === run;

  function forwardPatch(ts: string, page: { edge?: string; hasMore: boolean }) {
    const current = paging[ts]?.after;
    if (page.edge !== undefined && current !== undefined && Number(page.edge) < Number(current))
      return {};
    return {
      after: page.edge ?? current,
      hasMore: page.hasMore && page.edge !== undefined && page.edge !== current,
    };
  }

  async function loadAnchored(channelId: string, ts: string, anchor: string): Promise<Message[]> {
    anchorAttempted.set(ts, anchor);
    const run = startRun(ts);
    const [root, forward, earlier] = await Promise.all([
      api.fetchThreadRoot(channelId, ts),
      api.fetchRepliesFrom(channelId, ts, anchor),
      api.fetchRepliesBefore(channelId, ts, anchor),
    ]);
    if (!isRun(ts, run)) return cache.entry(ts) ?? [];
    const live = forward.hasMore
      ? []
      : (cache.entry(ts) ?? []).filter((m) => Number(m.ts) > Number(forward.edge ?? anchor));
    setPaging(ts, {
      ...idle,
      after: forward.edge,
      before: earlier.before,
      hasEarlier: earlier.hasEarlier,
      hasMore: forward.hasMore,
      span: earlier.span,
    });
    return mergeMessages(live, [...(root ? [root] : []), ...earlier.messages, ...forward.messages]);
  }

  async function loadFirst(channelId: string, ts: string) {
    const run = startRun(ts);
    const page = await api.fetchRepliesFrom(channelId, ts, ts);
    if (!isRun(ts, run)) return cache.entry(ts) ?? [];
    setPaging(ts, {
      ...idle,
      after: page.edge,
      before: undefined,
      hasEarlier: false,
      hasMore: page.hasMore,
    });
    return mergeMessages(cache.entry(ts) ?? [], page.messages);
  }

  async function catchUp(channelId: string, ts: string, after: string) {
    const run = runs.get(ts);
    const page = await api.fetchRepliesFrom(channelId, ts, after);
    if (!isRun(ts, run)) return cache.entry(ts) ?? [];
    setPaging(ts, forwardPatch(ts, page));
    return mergeMessages(cache.entry(ts) ?? [], page.messages);
  }

  const cache = createKeyedAsyncCache<Message[]>(
    (ts): Promise<Message[]> => {
      const channelId = channelForThread.get(ts);
      if (!channelId) return Promise.resolve([]);
      const anchor = anchorForThread.get(ts);
      anchorForThread.delete(ts);
      if (anchor) return loadAnchored(channelId, ts, anchor);
      const after = paging[ts]?.after;
      return after && missing(ts) === 0 ? catchUp(channelId, ts, after) : loadFirst(channelId, ts);
    },
    { onError: (err, ts) => console.error("Failed to load thread", ts, err) },
  );

  function missing(ts: string): number {
    const entry = cache.store[ts];
    const root = entry?.find((m) => m.ts === ts);
    const state = paging[ts];
    if (!(entry && root && state) || state.hasMore || state.hasEarlier) return 0;
    return Math.max(0, (root.replyCount ?? 0) - (entry.length - 1));
  }

  const settledMissing = (ts: string) => {
    const state = paging[ts];
    const busy = state?.loading || state?.earlierLoading || cache.isLoading(ts);
    return busy ? 0 : missing(ts);
  };

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
      void cache.refresh(ts).then(() => {
        if (anchorForThread.has(ts)) void cache.refresh(ts);
      });
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
    const run = runs.get(ts);
    setPaging(ts, { error: false, loading: true });
    try {
      const page = await api.fetchReplies(channelId, ts, state.after);
      if (!isRun(ts, run)) return;
      cache.update(ts, (existing) => mergeMessages(existing ?? [], page.messages));
      setPaging(ts, { ...forwardPatch(ts, page), loading: false });
    } catch (err) {
      console.error("Failed to load more replies", ts, err);
      if (isRun(ts, run)) setPaging(ts, { error: true, loading: false });
    }
  }

  async function loadEarlierReplies(ts: string) {
    const channelId = channelForThread.get(ts);
    const state = paging[ts];
    if (!(channelId && state?.hasEarlier && state.before) || state.earlierLoading) return;
    const run = runs.get(ts);
    setPaging(ts, { earlierError: false, earlierLoading: true });
    try {
      const page = await api.fetchRepliesBefore(channelId, ts, state.before, state.span);
      if (!isRun(ts, run)) return;
      cache.update(ts, (existing) => mergeMessages(existing ?? [], page.messages));
      setPaging(ts, {
        before: page.before,
        earlierLoading: false,
        hasEarlier: page.hasEarlier && page.before !== state.before,
        span: page.span,
      });
    } catch (err) {
      console.error("Failed to load earlier replies", ts, err);
      if (isRun(ts, run)) setPaging(ts, { earlierError: true, earlierLoading: false });
    }
  }

  createRecencyEviction({
    evict: (ts) => {
      if (cache.entry(ts)?.some((m) => m.deleted)) return;
      cache.invalidate(ts);
      runs.delete(ts);
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
    missingReplies: settledMissing,
    refreshThreadReplies: cache.refresh,
    setThreadMessages: cache.setStore,
    threadMessages: cache.store,
  };
}
