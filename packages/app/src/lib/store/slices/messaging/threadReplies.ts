import type { Message } from "@slock/types";
import { createKeyedAsyncCache, createRecencyEviction } from "@slock/ui";
import { createEffect, untrack } from "solid-js";
import { fetchReplies } from "../../../api";
import { mergeMessages } from "../../../messageMerge";
import type { ThreadRef } from "../types";

const KEEP_RECENT_THREADS = 3;

export function createThreadReplies(
  deps: { visibleThreads: () => ThreadRef[] },
  api: { fetchReplies: typeof fetchReplies } = { fetchReplies },
) {
  const channelForThread = new Map<string, string>();
  const fullyLoaded = new Set<string>();

  const cache = createKeyedAsyncCache<Message[]>(
    async (ts): Promise<Message[]> => {
      const channelId = channelForThread.get(ts);
      const messages = channelId ? await api.fetchReplies(channelId, ts) : [];
      fullyLoaded.add(ts);
      return mergeMessages(cache.entry(ts) ?? [], messages);
    },
    { onError: (err, ts) => console.error("Failed to load thread", ts, err) },
  );

  function ensureThreadRepliesLoaded(channelId: string, ts: string): void {
    channelForThread.set(ts, channelId);
    if (!fullyLoaded.has(ts)) void cache.refresh(ts);
  }
  createEffect(() => {
    for (const thread of deps.visibleThreads())
      untrack(() => ensureThreadRepliesLoaded(thread.channelId, thread.ts));
  });

  createRecencyEviction({
    evict: (ts) => {
      cache.invalidate(ts);
      channelForThread.delete(ts);
      fullyLoaded.delete(ts);
    },
    keepRecent: KEEP_RECENT_THREADS,
    visible: () => deps.visibleThreads().map((thread) => thread.ts),
  });

  return {
    ensureThreadRepliesLoaded,
    hasThreadError: cache.hasError,
    isLoadingThread: cache.isLoading,
    isThreadKnown: cache.isKnown,
    refreshThreadReplies: cache.refresh,
    setThreadMessages: cache.setStore,
    threadMessages: cache.store,
  };
}
