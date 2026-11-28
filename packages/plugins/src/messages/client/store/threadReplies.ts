import { createQueue } from "@slock/core";
import { fetchRepliesFrom } from "@slock/plugins/slack/client/api";
import { isTs } from "@slock/slack";
import type { ChannelId, Message, Ts } from "@slock/types";
import { createEffect, createStore, untrack } from "solid-js";
import type { ThreadRef } from "../api";
import { mergeMessages } from "../api/messageMerge";
import { createRecencyEviction } from "../lib/recencyEviction";
import { fetchReplies, fetchRepliesBefore } from "../requests/replies";
import { planThreadLoad } from "./history/loadPlan";
import { createRequestEpochs } from "./history/requestEpoch";
import { createThreadFetches, type ThreadApi } from "./history/threadFetches";
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

type ThreadLoad = { error: boolean; loading: boolean; stale?: boolean };

export function createThreadReplies(
  deps: { visibleThreads: () => ThreadRef[] },
  api: ThreadApi = { fetchReplies, fetchRepliesBefore, fetchRepliesFrom },
) {
  const channelForThread = new Map<Ts, ChannelId>();
  const anchorForThread = new Map<Ts, Ts>();
  const anchorAttempted = new Map<Ts, Ts>();
  const inFlight = new Map<Ts, Promise<void>>();
  const queue = createQueue(THREAD_FETCH_CONCURRENCY);
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

  const runs = createRequestEpochs<Ts>();
  const isRun = runs.isCurrent;

  const patchPaging = (ts: Ts, patch: Partial<ThreadPaging>) =>
    setPaging((s) => {
      const current = s[ts];
      if (current) Object.assign(current, patch);
      else s[ts] = { ...idle, hasEarlier: false, hasMore: false, ...patch };
    });

  const { loadAnchored, loadFirst, reloadWindow } = createThreadFetches({
    api,
    paging,
    patchPaging,
    runs,
    threadMessages,
  });

  function fetchThread(ts: Ts): Promise<Message[]> {
    const channelId = channelForThread.get(ts);
    if (!channelId) return Promise.resolve([]);
    const anchor = anchorForThread.get(ts);
    anchorForThread.delete(ts);
    if (anchor) {
      anchorAttempted.set(ts, anchor);
      return loadAnchored(channelId, ts, anchor);
    }
    const state = paging[ts];
    return state?.after ? reloadWindow(channelId, ts, state) : loadFirst(channelId, ts);
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
  const isThreadStale = (ts: Ts) => !!loads[ts]?.stale;

  function settledMissing(ts: Ts): number {
    const state = paging[ts];
    return state?.loading || state?.earlierLoading || isLoadingThread(ts)
      ? 0
      : missingReplyCount(threadMessages[ts], ts, state);
  }

  async function loadAround(ts: Ts, anchor: Ts) {
    anchorForThread.set(ts, anchor);
    await refreshThread(ts);
    if (anchorForThread.has(ts)) await refreshThread(ts);
  }

  function loadLatestReplies(ts: Ts) {
    const latest = threadMessages[ts]?.find((m) => m.ts === ts)?.latestReply;
    return latest && paging[ts]?.hasMore ? loadAround(ts, latest) : undefined;
  }

  function ensureThreadRepliesLoaded(channelId: ChannelId, ts: Ts, anchor?: Ts): boolean {
    return untrack(() => {
      channelForThread.set(ts, channelId);
      const stale = isThreadStale(ts);
      const plan = planThreadLoad({
        anchor,
        anchorAttempted: anchorAttempted.get(ts),
        anchorCovered: !!anchor && coversAnchor(paging[ts], ts, anchor),
        hasError: !stale && hasThreadError(ts),
        hasPaging: !stale && !!paging[ts],
        ts,
      });
      if (plan.kind === "none") return false;
      void (plan.kind === "anchored" ? loadAround(ts, plan.anchor) : refreshThread(ts));
      return true;
    });
  }

  createEffect(
    () => deps.visibleThreads(),
    (threads) => {
      untrack(() => {
        for (const thread of threads)
          ensureThreadRepliesLoaded(thread.channelId, thread.ts, thread.highlightTs);
      });
    },
  );

  async function loadMoreReplies(ts: Ts) {
    const channelId = channelForThread.get(ts);
    const state = paging[ts];
    if (!(channelId && state?.hasMore && state.after) || state.loading) return;
    const run = runs.current(ts);
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
    const run = runs.current(ts);
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

  function resyncThreads() {
    const visible = new Set(deps.visibleThreads().map((thread) => thread.ts));
    for (const ts of channelForThread.keys()) {
      inFlight.delete(ts);
      setLoads((s) => {
        s[ts] = { error: false, loading: false, stale: true };
      });
      if (visible.has(ts)) void refreshThread(ts);
    }
  }

  function evictThread(ts: Ts) {
    inFlight.delete(ts);
    runs.drop(ts);
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
    isThreadStale,
    loadEarlierReplies,
    loadLatestReplies,
    loadMoreReplies,
    missingReplies: settledMissing,
    dropThreadMessages,
    editThreadList,
    refreshThreadReplies: refreshThread,
    resyncThreads,
    threadMessages,
    updateThreadMessages,
  };
}
