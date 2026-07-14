import type { Message } from "@slock/slack-api";
import { fetchHistory, fetchReplies } from "@slock/slack-api";
import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import type { ThreadRef, View } from "../types";

export function createMessageHistory(deps: {
  activeView: () => View | null;
  activeThread: () => ThreadRef | null;
}) {
  const [messagesByChannel, setMessagesByChannel] = createStore<Record<string, Message[]>>({});
  const loadedChannels = new Set<string>();
  const historyCursor = new Map<string, string | undefined>();
  const [historyMeta, setHistoryMeta] = createStore<
    Record<string, { hasMore: boolean; loading: boolean }>
  >({});
  const [threadMessages, setThreadMessages] = createStore<Record<string, Message[]>>({});
  const loadedThreads = new Set<string>();
  createEffect(() => {
    const view = deps.activeView();
    if (!view) return;
    if (loadedChannels.has(view.id)) return;
    loadedChannels.add(view.id);
    fetchHistory(view.id)
      .then(({ messages, hasMore, nextCursor }) => {
        setMessagesByChannel(view.id, messages);
        historyCursor.set(view.id, nextCursor);
        setHistoryMeta(view.id, { hasMore, loading: false });
      })
      .catch(() => {
        loadedChannels.delete(view.id);
      });
  });
  createEffect(() => {
    const thread = deps.activeThread();
    if (!thread) return;
    const key = thread.ts;
    if (loadedThreads.has(key)) return;
    loadedThreads.add(key);
    fetchReplies(thread.channelId, thread.ts)
      .then((messages) => {
        setThreadMessages(key, messages);
      })
      .catch(() => {
        loadedThreads.delete(key);
      });
  });
  function hasMoreHistory(channelId: string) {
    return historyMeta[channelId]?.hasMore ?? true;
  }
  function isLoadingHistory(channelId: string) {
    return historyMeta[channelId]?.loading ?? false;
  }
  async function loadOlderMessages(channelId: string) {
    if (!loadedChannels.has(channelId)) return;
    const meta = historyMeta[channelId];
    if (meta?.loading || meta?.hasMore === false) return;
    const cursor = historyCursor.get(channelId);
    if (!cursor) {
      setHistoryMeta(channelId, "hasMore", false);
      return;
    }
    setHistoryMeta(channelId, "loading", true);
    try {
      const { messages: older, hasMore, nextCursor } = await fetchHistory(channelId, cursor);
      setMessagesByChannel(channelId, (existing = []) => {
        const existingIds = new Set(existing.map((m) => m.id));
        return [...older.filter((m) => !existingIds.has(m.id)), ...existing];
      });
      historyCursor.set(channelId, nextCursor);
      setHistoryMeta(channelId, { hasMore, loading: false });
    } catch {
      setHistoryMeta(channelId, "loading", false);
    }
  }
  return {
    hasMoreHistory,
    historyCursor,
    historyMeta,
    isLoadingHistory,
    loadedChannels,
    loadedThreads,
    loadOlderMessages,
    messagesByChannel,
    setMessagesByChannel,
    setThreadMessages,
    threadMessages,
  };
}
