import type { Message } from "@slock/slack-api";
import { fetchHistory, fetchPermalinkMessage, fetchReplies } from "@slock/slack-api";
import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import type { ThreadRef, View } from "../types";
import { mergeMessages } from "./merge/messageMerge";

// Bounds how many 60-message pages ensureChannelMessage will page through
// looking for a target ts before giving up — a thread root nobody's opened
// in ages shouldn't backfill the whole channel.
const ENSURE_MESSAGE_MAX_BACKFILL = 10;

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
  async function ensureThreadRepliesLoaded(channelId: string, ts: string) {
    if (loadedThreads.has(ts)) return;
    loadedThreads.add(ts);
    setThreadErrors(ts, false);
    try {
      const messages = await fetchReplies(channelId, ts);
      setThreadMessages(ts, messages);
    } catch {
      loadedThreads.delete(ts);
      setThreadErrors(ts, true);
    }
  }
  createEffect(() => {
    const thread = deps.activeThread();
    if (!thread) return;
    ensureThreadRepliesLoaded(thread.channelId, thread.ts);
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
      if (message) {
        setMessagesByChannel(channelId, (existing = []) => mergeMessages(existing, [message]));
        return true;
      }
    } catch (err) {
      console.error("Permalink lookup failed, falling back to paging history", err);
    }
    // The exact-ts permalink lookup can come back empty depending on how Slack
    // handles the oldest===latest range — page through older history the same
    // way scroll-triggered pagination does, until the target turns up or we
    // run out of history to fetch.
    for (let i = 0; i < ENSURE_MESSAGE_MAX_BACKFILL && hasMoreHistory(channelId); i++) {
      await loadOlderMessages(channelId);
      if (messagesByChannel[channelId]?.some((message) => message.ts === ts)) return true;
    }
    return false;
  }
  return {
    ensureChannelMessage,
    ensureThreadRepliesLoaded,
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
