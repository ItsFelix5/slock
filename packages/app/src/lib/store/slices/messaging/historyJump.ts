import type { SetStoreFunction, Store } from "solid-js/store";
import type { Message } from "../../../api";
import { mergeMessages } from "../../../messageMerge";

type HistoryMeta = {
  anchored?: boolean;
  hasMore: boolean;
  hasNewer?: boolean;
  initialError?: boolean;
  loading: boolean;
  newerError?: boolean;
  olderError?: boolean;
};

export function createHistoryJump(deps: {
  api: {
    fetchChannelDetails: (channelId: string) => Promise<{ created?: number }>;
    fetchHistoryAround: (
      channelId: string,
      ts: string,
    ) => Promise<{ messages: Message[]; hasMore: boolean; nextCursor?: string }>;
  };
  historyCursor: Map<string, string | undefined>;
  historyMeta: Store<Record<string, HistoryMeta>>;
  loadedChannels: Set<string>;
  loadRecentHistory: (channelId: string) => Promise<void>;
  messagesByChannel: Store<Record<string, Message[]>>;
  newerHistoryBoundary: Map<string, string>;
  setHistoryMeta: SetStoreFunction<Record<string, HistoryMeta>>;
  setMessagesByChannel: SetStoreFunction<Record<string, Message[]>>;
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
    loadRecentHistory,
    messagesByChannel,
    newerHistoryBoundary,
    setHistoryMeta,
    setMessagesByChannel,
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
      setMessagesByChannel(channelId, () => mergeMessages([], messages));
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
      return true;
    } catch (err) {
      console.error("Failed to fetch history around message", err);
      if (windowEpochs.isCurrent(channelId, epoch)) void loadRecentHistory(channelId);
      return false;
    }
  }

  async function jumpToDate(channelId: string, dateMs: number) {
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
    const endOfDay = new Date(dateMs);
    endOfDay.setHours(23, 59, 59, 999);
    const latestMs = Math.min(endOfDay.getTime(), Date.now());
    const ts = (latestMs / 1000).toFixed(6);
    try {
      const { messages, hasMore, nextCursor } = await api.fetchHistoryAround(channelId, ts);
      if (!windowEpochs.isCurrent(channelId, epoch)) return false;
      if (messages.length === 0) {
        void loadRecentHistory(channelId);
        return false;
      }
      setMessagesByChannel(channelId, () => mergeMessages([], messages));
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
      return true;
    } catch (err) {
      console.error("Failed to jump to date", channelId, err);
      if (windowEpochs.isCurrent(channelId, epoch)) void loadRecentHistory(channelId);
      return false;
    }
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

  return { ensureChannelMessage, jumpToBeginning, jumpToDate };
}
