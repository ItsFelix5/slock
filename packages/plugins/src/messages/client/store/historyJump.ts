import { startOfDay } from "@slock/core";
import { service } from "@slock/core/solid";
import { parseTs } from "@slock/slack";
import type { ChannelId, HistoryPage, Message, Ts } from "@slock/types";
import type { Store } from "solid-js";
import { mergeMessages } from "../api/messageMerge";
import { tsFromMs } from "../lib/tsTime";
import type { HistoryMeta } from "./history/historyFlags";

const env = service("env");

export function createHistoryJump(deps: {
  api: {
    fetchChannelDetails: (channelId: ChannelId) => Promise<{ created?: number }>;
    fetchHistoryAround: (channelId: ChannelId, ts: Ts) => Promise<HistoryPage>;
    fetchHistoryNewer: (channelId: ChannelId, oldest: Ts) => Promise<HistoryPage>;
  };
  historyCursor: Map<ChannelId, string | undefined>;
  historyMeta: Store<Record<ChannelId, HistoryMeta>>;
  loadedChannels: Set<ChannelId>;
  loadNewerMessages: (channelId: ChannelId) => Promise<void>;
  loadRecentHistory: (channelId: ChannelId) => Promise<void>;
  messagesByChannel: Store<Record<ChannelId, Message[]>>;
  newerHistoryBoundary: Map<ChannelId, Ts>;
  patchMeta: (channelId: ChannelId, patch: Partial<HistoryMeta>) => void;
  replaceMessages: (channelId: ChannelId, compute: (existing: Message[]) => Message[]) => void;
  windowEpochs: {
    begin: (key: ChannelId) => number;
    isCurrent: (key: ChannelId, epoch: number) => boolean;
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
    patchMeta,
    replaceMessages,
    windowEpochs,
  } = deps;

  async function ensureChannelMessage(channelId: ChannelId, ts: Ts) {
    if (messagesByChannel[channelId]?.some((message) => message.ts === ts)) return true;
    const epoch = windowEpochs.begin(channelId);
    const previous = historyMeta[channelId];
    patchMeta(channelId, {
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
      patchMeta(channelId, {
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

  async function jumpToTs(channelId: ChannelId, ts: Ts) {
    const epoch = windowEpochs.begin(channelId);
    const previous = historyMeta[channelId];
    patchMeta(channelId, {
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
      else
        newerHistoryBoundary.set(
          channelId,
          newer?.nextCursor ? parseTs(newer.nextCursor) : (messages.at(-1)?.ts ?? ts),
        );
      patchMeta(channelId, {
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

  function jumpToDate(channelId: ChannelId, dateMs: number) {
    const endOfDayMs = startOfDay(dateMs, 1) - 1;
    return jumpToTs(channelId, tsFromMs(Math.min(endOfDayMs, env.now())));
  }

  async function jumpToBeginning(channelId: ChannelId) {
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
