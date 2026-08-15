import type { Message } from "@slock/slack-api";
import { fetchReplies } from "@slock/slack-api";
import { createEffect, untrack } from "solid-js";
import { createStore } from "solid-js/store";
import type { ThreadRef } from "../types";
import { mergeMessages } from "./merge/messageMerge";

export function createThreadReplies(
  deps: { visibleThreads: () => ThreadRef[] },
  api: { fetchReplies: typeof fetchReplies } = { fetchReplies },
) {
  const [threadMessages, setThreadMessages] = createStore<Record<string, Message[]>>({});
  const loadedThreads = new Set<string>();
  const [threadMeta, setThreadMeta] = createStore<
    Record<string, { error: boolean; loading: boolean }>
  >({});

  async function ensureThreadRepliesLoaded(channelId: string, ts: string, highlightTs?: string) {
    const hasTarget =
      !highlightTs || untrack(() => threadMessages[ts] ?? []).some((m) => m.ts === highlightTs);
    if ((loadedThreads.has(ts) && hasTarget) || threadMeta[ts]?.loading) return;
    loadedThreads.add(ts);
    setThreadMeta(ts, { error: false, loading: true });
    try {
      const messages = await api.fetchReplies(channelId, ts, {
        untilTs: highlightTs,
      });
      setThreadMessages(ts, (existing = []) => mergeMessages(existing, messages));
      setThreadMeta(ts, { error: false, loading: false });
    } catch {
      loadedThreads.delete(ts);
      setThreadMeta(ts, { error: true, loading: false });
    }
  }
  createEffect(() => {
    for (const thread of deps.visibleThreads())
      ensureThreadRepliesLoaded(thread.channelId, thread.ts, thread.highlightTs);
  });

  function hasThreadError(ts: string) {
    return threadMeta[ts]?.error ?? false;
  }
  function isLoadingThread(ts: string) {
    return threadMeta[ts]?.loading ?? false;
  }

  return {
    ensureThreadRepliesLoaded,
    hasThreadError,
    isLoadingThread,
    loadedThreads,
    setThreadMessages,
    threadMessages,
  };
}
