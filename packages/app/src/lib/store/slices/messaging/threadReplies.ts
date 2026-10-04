import type { Message } from "@slock/types";
import { createKeyedAsyncCache } from "@slock/ui";
import { createEffect } from "solid-js";
import { fetchReplies, fetchReplyWindow } from "../../../api";
import { mergeMessages } from "../../../messageMerge";
import type { ThreadRef } from "../types";

export function createThreadReplies(
  deps: { visibleThreads: () => ThreadRef[] },
  api: { fetchReplies: typeof fetchReplies; fetchReplyWindow: typeof fetchReplyWindow } = {
    fetchReplies,
    fetchReplyWindow,
  },
) {
  const channelForThread = new Map<string, string>();

  const cache = createKeyedAsyncCache<Message[]>(
    async (ts): Promise<Message[]> => {
      const channelId = channelForThread.get(ts);
      const messages = channelId ? await api.fetchReplies(channelId, ts) : [];
      return mergeMessages(cache.entry(ts) ?? [], messages);
    },
    { onError: (err, ts) => console.error("Failed to load thread", ts, err) },
  );

  function ensureThreadRepliesLoaded(channelId: string, ts: string): void {
    channelForThread.set(ts, channelId);
    void cache.ensure(ts);
  }
  async function ensureThreadMessage(channelId: string, threadTs: string, ts: string) {
    if (cache.entry(threadTs)?.some((m) => m.ts === ts)) return;
    try {
      const window = await api.fetchReplyWindow(channelId, threadTs, ts);
      cache.update(threadTs, (current) => mergeMessages(current ?? [], window));
    } catch (err) {
      console.error("Failed to fetch thread reply", err);
    }
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
    ensureThreadMessage,
    ensureThreadRepliesLoaded,
    hasThreadError,
    isLoadingThread,
    isThreadKnown,
    refreshThreadReplies: cache.refresh,
    setThreadMessages: cache.setStore,
    threadMessages: cache.store,
  };
}
