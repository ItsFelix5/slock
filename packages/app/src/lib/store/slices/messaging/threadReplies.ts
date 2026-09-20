import { createKeyedAsyncCache } from "@slock/ui";
import { createEffect } from "solid-js";
import type { Message } from "../../../api";
import { fetchReplies } from "../../../api";
import { mergeMessages } from "../../../messageMerge";
import type { ThreadRef } from "../types";

export function createThreadReplies(
  deps: { visibleThreads: () => ThreadRef[] },
  api: { fetchReplies: typeof fetchReplies } = { fetchReplies },
) {
  const channelForThread = new Map<string, string>();

  const cache = createKeyedAsyncCache<Message[]>(async (ts) => {
    const channelId = channelForThread.get(ts);
    const messages = channelId ? await api.fetchReplies(channelId, ts) : [];
    return mergeMessages(cache.entry(ts) ?? [], messages);
  });

  function ensureThreadRepliesLoaded(channelId: string, ts: string): void {
    channelForThread.set(ts, channelId);
    void cache.ensure(ts);
  }
  createEffect(() => {
    for (const thread of deps.visibleThreads())
      ensureThreadRepliesLoaded(thread.channelId, thread.ts);
  });

  function hasThreadError(ts: string) {
    return cache.hasError(ts);
  }
  function isLoadingThread(ts: string) {
    return cache.isLoading(ts);
  }
  function isThreadKnown(ts: string) {
    return cache.isKnown(ts);
  }

  return {
    ensureThreadRepliesLoaded,
    hasThreadError,
    isLoadingThread,
    isThreadKnown,
    refreshThreadReplies: cache.refresh,
    setThreadMessages: cache.setStore,
    threadMessages: cache.store,
  };
}
