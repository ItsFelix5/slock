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

export function createHistoryFlags(historyMeta: Store<Record<string, HistoryMeta>>) {
  return {
    hasHistoryError: (channelId: string) => historyMeta[channelId]?.initialError ?? false,
    hasMoreHistory: (channelId: string) => historyMeta[channelId]?.hasMore ?? true,
    hasNewerHistory: (channelId: string) =>
      historyMeta[channelId]?.hasNewer ?? historyMeta[channelId]?.anchored === true,
    hasNewerHistoryError: (channelId: string) => historyMeta[channelId]?.newerError ?? false,
    hasOlderHistoryError: (channelId: string) => historyMeta[channelId]?.olderError ?? false,
    isLoadingHistory: (channelId: string) => historyMeta[channelId]?.loading ?? false,
  };
}
