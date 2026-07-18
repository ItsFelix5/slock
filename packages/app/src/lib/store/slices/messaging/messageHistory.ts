import type { Message } from "@slock/slack-api";
import { fetchHistory, fetchPermalinkMessage, fetchReplies } from "@slock/slack-api";
import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import type { ThreadRef, View } from "../types";
import { mergeMessages } from "./merge/messageMerge";

export function createMessageHistory(deps: {
  activeView: () => View | null;
  activeThread: () => ThreadRef | null;
}) {
  const [messagesByChannel, setMessagesByChannel] = createStore<Record<string, Message[]>>({});
  const loadedChannels = new Set<string>();
  const historyCursor = new Map<string, string | undefined>();
  const [historyMeta, setHistoryMeta] = createStore<
    Record<string, { hasMore: boolean; loading: boolean; error?: boolean }>
  >({});
  const [threadMessages, setThreadMessages] = createStore<Record<string, Message[]>>({});
  const loadedThreads = new Set<string>();
  createEffect(() => {
    const view = deps.activeView();
    if (!view) return;
    if (loadedChannels.has(view.id)) return;
    loadedChannels.add(view.id);
    setHistoryMeta(view.id, { hasMore: true, loading: true });
    fetchHistory(view.id)
      .then(({ messages, hasMore, nextCursor }) => {
        setMessagesByChannel(view.id, (existing = []) => mergeMessages(existing, messages));
        historyCursor.set(view.id, nextCursor);
        setHistoryMeta(view.id, { hasMore, loading: false });
      })
      .catch(() => {
        loadedChannels.delete(view.id);
        setHistoryMeta(view.id, { hasMore: false, loading: false, error: true });
      });
  });
  const [threadErrors, setThreadErrors] = createStore<Record<string, boolean>>({});
  createEffect(() => {
    const thread = deps.activeThread();
    if (!thread) return;
    const key = thread.ts;
    if (loadedThreads.has(key)) return;
    loadedThreads.add(key);
    setThreadErrors(key, false);
    fetchReplies(thread.channelId, thread.ts)
      .then((messages) => {
        setThreadMessages(key, messages);
      })
      .catch(() => {
        loadedThreads.delete(key);
        setThreadErrors(key, true);
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
      setMessagesByChannel(channelId, (existing = []) => mergeMessages(existing, older));
      historyCursor.set(channelId, nextCursor);
      setHistoryMeta(channelId, { hasMore, loading: false });
    } catch {
      setHistoryMeta(channelId, "loading", false);
    }
  }
  function hasHistoryError(channelId: string) {
    return historyMeta[channelId]?.error ?? false;
  }
  function hasThreadError(ts: string) {
    return threadErrors[ts] ?? false;
  }
  async function ensureChannelMessage(channelId: string, ts: string) {
    if (messagesByChannel[channelId]?.some((message) => message.ts === ts)) return true;
    try {
      const message = await fetchPermalinkMessage(channelId, ts, ts);
      if (!message) return false;
      setMessagesByChannel(channelId, (existing = []) => mergeMessages(existing, [message]));
      return true;
    } catch {
      return false;
    }
  }
  return {
    ensureChannelMessage,
    hasHistoryError,
    hasMoreHistory,
    hasThreadError,
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
