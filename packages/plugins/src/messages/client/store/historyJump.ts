import type { HistoryPage, Message } from "@slock/types";
import type { SetStoreFunction, Store } from "solid-js/store";
import { mergeMessages } from "../api/messageMerge";
import type { HistoryMeta } from "./history/historyFlags";

export function createHistoryJump(deps: {
  api: {
    fetchChannelDetails: (channelId: string) => Promise<{ created?: number }>;
    fetchHistoryAround: (channelId: string, ts: string) => Promise<HistoryPage>;
    fetchHistoryNewer: (channelId: string, oldest: string) => Promise<HistoryPage>;
  };
  historyCursor: Map<string, string | undefined>;
  historyMeta: Store<Record<string, HistoryMeta>>;
  loadedChannels: Set<string>;
  loadNewerMessages: (channelId: string) => Promise<void>;
  loadRecentHistory: (channelId: string) => Promise<void>;
  messagesByChannel: Store<Record<string, Message[]>>;
  newerHistoryBoundary: Map<string, string>;
  replaceMessages: (channelId: string, compute: (existing: Message[]) => Message[]) => void;
  setHistoryMeta: SetStoreFunction<Record<string, HistoryMeta>>;
  windowEpochs: {
    begin: (key: string) => number;
    isCurrent: (key: string, epoch: number) => boolean;
  };
}) {
  const {
    api,
    historyCursor,
    historyMeta,
    loadedChannels,
    loadNewerMessages,
    loadRecentHistory,
    messagesByChannel,
    newerHistoryBoundary,
    replaceMessages,
    setHistoryMeta,
    windowEpochs,
  } = deps;

  async function ensureChannelMessage(channelId: string, ts: string) {
    if (messagesByChannel[channelId]?.some((message) => message.ts === ts)) return true;
    const epoch = windowEpochs.begin(channelId);
    const previous = historyMeta[channelId];
    setHistoryMeta(channelId, {
      anchored: previous?.anchored,
      hasMore: previous?.hasMore ?? true,
      initialError: false,
      loading: true,
      newerError: false,
      olderError: false,
    });
    try {
      const { messages, hasMore, nextCursor } = await api.fetchHistoryAround(channelId, ts);
      if (!windowEpochs.isCurrent(channelId, epoch)) return false;
      if (!messages.some((message) => message.ts === ts)) {
        void loadRecentHistory(channelId);
        return false;
      }
      replaceMessages(channelId, () => mergeMessages([], messages));
      historyCursor.set(channelId, nextCursor);
      newerHistoryBoundary.set(channelId, messages.at(-1)?.ts ?? ts);
      setHistoryMeta(channelId, {
        anchored: true,
        hasMore,
        hasNewer: true,
        initialError: false,
        loading: false,
        newerError: false,
        olderError: false,
      });
      loadedChannels.add(channelId);
      void loadNewerMessages(channelId);
      return true;
    } catch (err) {
      console.error("Failed to fetch history around message", err);
      if (windowEpochs.isCurrent(channelId, epoch)) void loadRecentHistory(channelId);
      return false;
    }
  }

  async function jumpToTs(channelId: string, ts: string) {
    const epoch = windowEpochs.begin(channelId);
    const previous = historyMeta[channelId];
    setHistoryMeta(channelId, {
      anchored: previous?.anchored,
      hasMore: previous?.hasMore ?? true,
      initialError: false,
      loading: true,
      newerError: false,
      olderError: false,
    });
    try {
      const around = await api.fetchHistoryAround(channelId, ts);
      const fromStart = around.messages.length === 0;
      const newer = fromStart ? await api.fetchHistoryNewer(channelId, ts) : undefined;
      if (!windowEpochs.isCurrent(channelId, epoch)) return false;
      const messages = newer?.messages ?? around.messages;
      if (messages.length === 0) {
        void loadRecentHistory(channelId);
        return false;
      }
      replaceMessages(channelId, () => mergeMessages([], messages));
      historyCursor.set(channelId, fromStart ? undefined : around.nextCursor);
      if (newer && !newer.hasMore) newerHistoryBoundary.delete(channelId);
      else newerHistoryBoundary.set(channelId, newer?.nextCursor ?? messages.at(-1)?.ts ?? ts);
      setHistoryMeta(channelId, {
        anchored: !newer || newer.hasMore,
        hasMore: !fromStart && around.hasMore,
        hasNewer: !newer || newer.hasMore,
        initialError: false,
        loading: false,
        newerError: false,
        olderError: false,
      });
      loadedChannels.add(channelId);
      return true;
    } catch (err) {
      console.error("Failed to jump to message window", channelId, err);
      if (windowEpochs.isCurrent(channelId, epoch)) void loadRecentHistory(channelId);
      return false;
    }
  }

  function jumpToDate(channelId: string, dateMs: number) {
    const endOfDay = new Date(dateMs);
    endOfDay.setHours(23, 59, 59, 999);
    const latestMs = Math.min(endOfDay.getTime(), Date.now());
    return jumpToTs(channelId, (latestMs / 1000).toFixed(6));
  }

  async function jumpToBeginning(channelId: string) {
    try {
      const details = await api.fetchChannelDetails(channelId);
      if (!details.created) return false;
      return await jumpToDate(channelId, details.created * 1000);
    } catch (err) {
      console.error("Failed to jump to beginning", channelId, err);
      return false;
    }
  }

  return { ensureChannelMessage, jumpToBeginning, jumpToDate, jumpToTs };
}
