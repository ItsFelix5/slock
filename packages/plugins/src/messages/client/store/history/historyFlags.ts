import type { ChannelId } from "@slock/types";
import type { Store } from "solid-js/store";

export type HistoryMeta = {
  anchored?: boolean;
  hasMore: boolean;
  hasNewer?: boolean;
  initialError?: boolean;
  loading: boolean;
  newerError?: boolean;
  olderError?: boolean;
};

export function createHistoryFlags(historyMeta: Store<Record<ChannelId, HistoryMeta>>) {
  return {
    hasHistoryError: (channelId: ChannelId) => historyMeta[channelId]?.initialError ?? false,
    hasMoreHistory: (channelId: ChannelId) => historyMeta[channelId]?.hasMore ?? true,
    hasNewerHistory: (channelId: ChannelId) =>
      historyMeta[channelId]?.hasNewer ?? historyMeta[channelId]?.anchored === true,
    hasNewerHistoryError: (channelId: ChannelId) => historyMeta[channelId]?.newerError ?? false,
    hasOlderHistoryError: (channelId: ChannelId) => historyMeta[channelId]?.olderError ?? false,
    isLoadingHistory: (channelId: ChannelId) => historyMeta[channelId]?.loading ?? false,
  };
}
