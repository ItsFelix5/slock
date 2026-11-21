import { isTs } from "@slock/slack";
import type { ChannelId, Message, Ts } from "@slock/types";
import { createConcurrencyQueue, createRecencyEviction } from "@slock/ui";
import { createEffect, createStore, untrack } from "solid-js";
import {
  fetchReplies,
  fetchRepliesBefore,
  fetchRepliesFrom,
  fetchThreadRoot,
} from "../../../slack/client/api";
import type { ThreadRef } from "../api";
import { mergeMessages } from "../api/messageMerge";
import { planThreadLoad } from "./history/loadPlan";
import {
  coversAnchor,
  forwardPatch,
  idle,
  missingReplyCount,
  type ThreadPaging,
} from "./history/threadPaging";
import { ensureMessageList, replaceMessageList, updateMessageList } from "./storeWrites";

const KEEP_RECENT_THREADS = 8;
const THREAD_FETCH_CONCURRENCY = 4;

type ThreadLoad = { error: boolean; loading: boolean };

type ThreadApi = {
  fetchReplies: typeof fetchReplies;
  fetchRepliesBefore: typeof fetchRepliesBefore;
  fetchRepliesFrom: typeof fetchRepliesFrom;
  fetchThreadRoot: typeof fetchThreadRoot;
};

export function createThreadReplies(
  deps: { visibleThreads: () => ThreadRef[] },
  api: ThreadApi = { fetchReplies, fetchRepliesBefore, fetchRepliesFrom, fetchThreadRoot },
) {
  const channelForThread = new Map<Ts, ChannelId>();
  const anchorForThread = new Map<Ts, Ts>();
  const anchorAttempted = new Map<Ts, Ts>();
  const inFlight = new Map<Ts, Promise<void>>();
  const queue = createConcurrencyQueue(THREAD_FETCH_CONCURRENCY);
  const [threadMessages, setThreadMessages] = createStore<Record<Ts, Message[]>>({});
  const editThreadList = (ts: Ts, edit: (list: Message[]) => void) =>
    setThreadMessages((s) => edit(ensureMessageList(s, ts)));
  const updateThreadMessages = (ts: Ts, compute: (existing: Message[]) => Message[]) =>
    setThreadMessages((s) => updateMessageList(s, ts, compute));
  const dropThreadMessages = (ts: Ts) =>
    setThreadMessages((s) => {
      delete s[ts];
    });
  const [paging, setPaging] = createStore<Record<Ts, ThreadPaging>>({});
  const [loads, setLoads] = createStore<Record<Ts, ThreadLoad>>({});

  let lastRun = 0;
  const runs = new Map<Ts, number>();
  const startRun = (ts: Ts) => {
    runs.set(ts, ++lastRun);
    return lastRun;
  };
  const isRun = (ts: Ts, run: number | undefined) => run !== undefined && runs.get(ts) === run;

  const patchPaging = (ts: Ts, patch: Partial<ThreadPaging>) =>
    setPaging((s) => {
      const current = s[ts];
      if (current) Object.assign(current, patch);
      else s[ts] = { ...idle, hasEarlier: false, hasMore: false, ...patch };
    });

  async function loadAnchored(channelId: ChannelId, ts: Ts, anchor: Ts): Promise<Message[]> {
    anchorAttempted.set(ts, anchor);
    const run = startRun(ts);
    const [root, forward, earlier] = await Promise.all([
      api.fetchThreadRoot(channelId, ts),
      api.fetchRepliesFrom(channelId, ts, anchor),
      api.fetchRepliesBefore(channelId, ts, anchor),
    ]);
    const current = threadMessages[ts] ?? [];
    if (!isRun(ts, run)) return current;
    const live = forward.hasMore
      ? []
      : current.filter((m) => Number(m.ts) > Number(forward.edge ?? anchor));
    patchPaging(ts, {
      ...idle,
      after: forward.edge,
      before: earlier.before,
      hasEarlier: earlier.hasEarlier,
      hasMore: forward.hasMore,
      span: earlier.span,
    });
    return mergeMessages(live, [...(root ? [root] : []), ...earlier.messages, ...forward.messages]);
  }

  async function loadFirst(channelId: ChannelId, ts: Ts) {
    const run = startRun(ts);
    const page = await api.fetchRepliesFrom(channelId, ts, ts);
    const current = threadMessages[ts] ?? [];
    if (!isRun(ts, run)) return current;
    patchPaging(ts, {
      ...idle,
      after: page.edge,
      before: undefined,
      hasEarlier: false,
      hasMore: page.hasMore,
    });
    return mergeMessages(current, page.messages);
  }

  async function catchUp(channelId: ChannelId, ts: Ts, after: Ts) {
    const run = runs.get(ts);
    const page = await api.fetchRepliesFrom(channelId, ts, after);
    const current = threadMessages[ts] ?? [];
    if (!isRun(ts, run)) return current;
    patchPaging(ts, forwardPatch(paging[ts]?.after, page));
    return mergeMessages(current, page.messages);
  }

  const missing = (ts: Ts) => missingReplyCount(threadMessages[ts], ts, paging[ts]);

  function fetchThread(ts: Ts): Promise<Message[]> {
    const channelId = channelForThread.get(ts);
    if (!channelId) return Promise.resolve([]);
    const anchor = anchorForThread.get(ts);
    anchorForThread.delete(ts);
    if (anchor) return loadAnchored(channelId, ts, anchor);
    const after = paging[ts]?.after;
    return after && missing(ts) === 0 ? catchUp(channelId, ts, after) : loadFirst(channelId, ts);
  }

  function refreshThread(ts: Ts): Promise<void> {
    const existing = inFlight.get(ts);
    if (existing) return existing;
    setLoads((s) => {
      s[ts] = { error: false, loading: true };
    });
    const isCurrent = () => inFlight.get(ts) === request;
    const request: Promise<void> = queue
      .run(() => fetchThread(ts))
      .then((messages) => {
        if (isCurrent()) setThreadMessages((s) => replaceMessageList(s, ts, messages));
      })
      .catch((err: unknown) => {
        if (!isCurrent()) return;
        console.error("Failed to load thread", ts, err);
        setLoads((s) => {
          s[ts] = { error: true, loading: true };
        });
      })
      .finally(() => {
        if (!isCurrent()) return;
        inFlight.delete(ts);
        setLoads((s) => {
          const load = s[ts];
          if (load) load.loading = false;
        });
      });
    inFlight.set(ts, request);
    return request;
  }

  const isLoadingThread = (ts: Ts) => !!loads[ts]?.loading;
  const hasThreadError = (ts: Ts) => !!loads[ts]?.error;

  function settledMissing(ts: Ts): number {
    const state = paging[ts];
    return state?.loading || state?.earlierLoading || isLoadingThread(ts) ? 0 : missing(ts);
  }

  function ensureThreadRepliesLoaded(channelId: ChannelId, ts: Ts, anchor?: Ts): boolean {
    channelForThread.set(ts, channelId);
    const plan = planThreadLoad({
      anchor,
      anchorAttempted: anchorAttempted.get(ts),
      anchorCovered: !!anchor && coversAnchor(paging[ts], ts, anchor),
      hasError: hasThreadError(ts),
      hasPaging: !!paging[ts],
      ts,
    });
    if (plan.kind === "none") return false;
    if (plan.kind === "anchored") {
      anchorForThread.set(ts, plan.anchor);
      void refreshThread(ts).then(() => {
        if (anchorForThread.has(ts)) void refreshThread(ts);
      });
      return true;
    }
    void refreshThread(ts);
    return true;
  }

  createEffect(
    () => deps.visibleThreads(),
    (threads) => {
      for (const thread of threads)
        untrack(() => ensureThreadRepliesLoaded(thread.channelId, thread.ts, thread.highlightTs));
    },
  );

  async function loadMoreReplies(ts: Ts) {
    const channelId = channelForThread.get(ts);
    const state = paging[ts];
    if (!(channelId && state?.hasMore && state.after) || state.loading) return;
    const run = runs.get(ts);
    patchPaging(ts, { error: false, loading: true });
    try {
      const page = await api.fetchReplies(channelId, ts, state.after);
      if (!isRun(ts, run)) return;
      setThreadMessages((s) =>
        updateMessageList(s, ts, (existing) => mergeMessages(existing, page.messages)),
      );
      patchPaging(ts, { ...forwardPatch(paging[ts]?.after, page), loading: false });
    } catch (err) {
      console.error("Failed to load more replies", ts, err);
      if (isRun(ts, run)) patchPaging(ts, { error: true, loading: false });
    }
  }

  async function loadEarlierReplies(ts: Ts) {
    const channelId = channelForThread.get(ts);
    const state = paging[ts];
    if (!(channelId && state?.hasEarlier && state.before) || state.earlierLoading) return;
    const run = runs.get(ts);
    patchPaging(ts, { earlierError: false, earlierLoading: true });
    try {
      const page = await api.fetchRepliesBefore(channelId, ts, state.before, state.span);
      if (!isRun(ts, run)) return;
      setThreadMessages((s) =>
        updateMessageList(s, ts, (existing) => mergeMessages(existing, page.messages)),
      );
      patchPaging(ts, {
        before: page.before,
        earlierLoading: false,
        hasEarlier: page.hasEarlier && page.before !== state.before,
        span: page.span,
      });
    } catch (err) {
      console.error("Failed to load earlier replies", ts, err);
      if (isRun(ts, run)) patchPaging(ts, { earlierError: true, earlierLoading: false });
    }
  }

  function evictThread(ts: Ts) {
    if (threadMessages[ts]?.some((m) => m.deleted)) return;
    inFlight.delete(ts);
    runs.delete(ts);
    channelForThread.delete(ts);
    anchorForThread.delete(ts);
    anchorAttempted.delete(ts);
    dropThreadMessages(ts);
    setPaging((s) => {
      delete s[ts];
    });
    setLoads((s) => {
      delete s[ts];
    });
  }

  createRecencyEviction({
    evict: (ts) => {
      if (isTs(ts)) evictThread(ts);
    },
    keepRecent: KEEP_RECENT_THREADS,
    visible: () => deps.visibleThreads().map((thread) => thread.ts),
  });

  return {
    acceptsLiveReplies: (ts: Ts) =>
      (ts in threadMessages || isLoadingThread(ts)) && !paging[ts]?.hasMore,
    ensureThreadRepliesLoaded,
    hasEarlierReplies: (ts: Ts) => paging[ts]?.hasEarlier ?? false,
    hasEarlierRepliesError: (ts: Ts) => paging[ts]?.earlierError ?? false,
    hasMoreReplies: (ts: Ts) => paging[ts]?.hasMore ?? false,
    hasMoreRepliesError: (ts: Ts) => paging[ts]?.error ?? false,
    hasThreadError,
    isLoadingEarlierReplies: (ts: Ts) => paging[ts]?.earlierLoading ?? false,
    isLoadingMoreReplies: (ts: Ts) => paging[ts]?.loading ?? false,
    isLoadingThread,
    loadEarlierReplies,
    loadMoreReplies,
    missingReplies: settledMissing,
    dropThreadMessages,
    editThreadList,
    refreshThreadReplies: refreshThread,
    threadMessages,
    updateThreadMessages,
  };
}
