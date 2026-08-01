import type { Message } from "@slock/slack-api";
import { fetchHistory, fetchHistoryAround, fetchReplies } from "@slock/slack-api";
import { createEffect, untrack } from "solid-js";
import { createStore } from "solid-js/store";
import type { ThreadRef, View } from "../types";
import { createRequestEpochs } from "./history/requestEpoch";
import { mergeMessages } from "./merge/messageMerge";

type HistoryMeta = {
  anchored?: boolean;
  hasMore: boolean;
  initialError?: boolean;
  loading: boolean;
  olderError?: boolean;
};

type MessageHistoryApi = {
  fetchHistory: typeof fetchHistory;
  fetchHistoryAround: typeof fetchHistoryAround;
  fetchReplies: typeof fetchReplies;
};

const DEFAULT_HISTORY_API: MessageHistoryApi = { fetchHistory, fetchHistoryAround, fetchReplies };

export function createMessageHistory(
  deps: {
    activeView: () => View | null;
    activeThread: () => ThreadRef | null;
  },
  api: MessageHistoryApi = DEFAULT_HISTORY_API,
) {
  const [messagesByChannel, setMessagesByChannel] = createStore<Record<string, Message[]>>({});
  const loadedChannels = new Set<string>();
  const historyCursor = new Map<string, string | undefined>();
  const [historyMeta, setHistoryMeta] = createStore<Record<string, HistoryMeta>>({});
  const windowEpochs = createRequestEpochs();
  const [threadMessages, setThreadMessages] = createStore<Record<string, Message[]>>({});
  // Reacted messages surfaced in the activity feed, keyed by `channel:ts`.
  // Kept apart from the channel window (which ensureChannelMessage rebuilds as
  // a permalink island) so viewing the feed neither disturbs an open channel
  // nor lets sibling reaction items clobber each other; reaction toggles and
  // gateway events still reach these via patchMessage (see findMessageLocations).
  const [reactionMessages, setReactionMessages] = createStore<Record<string, Message[]>>({});
  const loadedThreads = new Set<string>();
  async function loadRecentHistory(channelId: string) {
    const replaceAnchoredWindow = historyMeta[channelId]?.anchored === true;
    const epoch = windowEpochs.begin(channelId);
    loadedChannels.add(channelId);
    setHistoryMeta(channelId, {
      anchored: false,
      hasMore: true,
      initialError: false,
      loading: true,
      olderError: false,
    });
    try {
      const { messages, hasMore, nextCursor } = await api.fetchHistory(channelId);
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      setMessagesByChannel(channelId, (existing = []) =>
        replaceAnchoredWindow ? messages : mergeMessages(existing, messages),
      );
      historyCursor.set(channelId, nextCursor);
      setHistoryMeta(channelId, { hasMore, loading: false });
    } catch {
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      loadedChannels.delete(channelId);
      setHistoryMeta(channelId, { hasMore: true, initialError: true, loading: false });
    }
  }
  createEffect(() => {
    const view = deps.activeView();
    if (!view) return;
    // Re-fetches on every switch to a channel whose loaded window is a
    // permalink-jumped island rather than the live tail (see
    // ensureChannelMessage) — leaving and re-entering the channel is how you
    // get back to "now", the same way Slack's own permalink view works.
    const alreadyAtPresent =
      loadedChannels.has(view.id) && !untrack(() => historyMeta[view.id]?.anchored);
    if (alreadyAtPresent) return;
    loadRecentHistory(view.id);
  });
  const [threadMeta, setThreadMeta] = createStore<
    Record<string, { error: boolean; loading: boolean }>
  >({});
  async function ensureThreadRepliesLoaded(channelId: string, ts: string) {
    if (loadedThreads.has(ts) || threadMeta[ts]?.loading) return;
    loadedThreads.add(ts);
    setThreadMeta(ts, { error: false, loading: true });
    try {
      const messages = await api.fetchReplies(channelId, ts);
      setThreadMessages(ts, (existing = []) => mergeMessages(existing, messages));
      setThreadMeta(ts, { error: false, loading: false });
    } catch {
      loadedThreads.delete(ts);
      setThreadMeta(ts, { error: true, loading: false });
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
    const epoch = windowEpochs.current(channelId);
    setHistoryMeta(channelId, "loading", true);
    setHistoryMeta(channelId, "olderError", false);
    try {
      const { messages: older, hasMore, nextCursor } = await api.fetchHistory(channelId, cursor);
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      setMessagesByChannel(channelId, (existing = []) => mergeMessages(existing, older));
      historyCursor.set(channelId, nextCursor);
      setHistoryMeta(channelId, { hasMore, loading: false });
    } catch {
      if (!windowEpochs.isCurrent(channelId, epoch)) return;
      setHistoryMeta(channelId, "loading", false);
      setHistoryMeta(channelId, "olderError", true);
    }
  }
  function hasHistoryError(channelId: string) {
    return historyMeta[channelId]?.initialError ?? false;
  }
  function hasOlderHistoryError(channelId: string) {
    return historyMeta[channelId]?.olderError ?? false;
  }
  function hasThreadError(ts: string) {
    return threadMeta[ts]?.error ?? false;
  }
  function isLoadingThread(ts: string) {
    return threadMeta[ts]?.loading ?? false;
  }
  // Jumping to a message that isn't in the loaded window fetches a bounded
  // page around it (same `latest`+`inclusive` history request Slack's own
  // client makes for a permalink) rather than a zero-width `oldest===latest`
  // lookup, which Slack's API doesn't reliably resolve to the exact message.
  // This *replaces* the loaded window instead of merging into it — merging
  // would sort the old page in right next to whatever was already loaded,
  // making an unfetched gap of possibly months of messages look contiguous.
  // Re-anchors the channel the same way Slack's own permalink view does;
  // loadRecentHistory (above) is what brings you back to "now".
  async function ensureChannelMessage(channelId: string, ts: string) {
    if (messagesByChannel[channelId]?.some((message) => message.ts === ts)) return true;
    const epoch = windowEpochs.begin(channelId);
    const previous = historyMeta[channelId];
    setHistoryMeta(channelId, {
      anchored: previous?.anchored,
      hasMore: previous?.hasMore ?? true,
      initialError: false,
      loading: true,
      olderError: false,
    });
    try {
      const { messages, hasMore, nextCursor } = await api.fetchHistoryAround(channelId, ts);
      if (!windowEpochs.isCurrent(channelId, epoch)) return false;
      if (!messages.some((message) => message.ts === ts)) {
        void loadRecentHistory(channelId);
        return false;
      }
      setMessagesByChannel(channelId, messages);
      historyCursor.set(channelId, nextCursor);
      setHistoryMeta(channelId, {
        anchored: true,
        hasMore,
        initialError: false,
        loading: false,
        olderError: false,
      });
      loadedChannels.add(channelId);
      return true;
    } catch (err) {
      console.error("Failed to fetch history around message", err);
      if (windowEpochs.isCurrent(channelId, epoch)) void loadRecentHistory(channelId);
      return false;
    }
  }
  return {
    ensureChannelMessage,
    ensureThreadRepliesLoaded,
    hasHistoryError,
    hasMoreHistory,
    hasOlderHistoryError,
    hasThreadError,
    historyCursor,
    historyMeta,
    isLoadingHistory,
    isLoadingThread,
    loadedChannels,
    loadedThreads,
    loadOlderMessages,
    loadRecentHistory,
    messagesByChannel,
    reactionMessages,
    setMessagesByChannel,
    setReactionMessages,
    setThreadMessages,
    threadMessages,
  };
}
