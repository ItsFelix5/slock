import { createEffect } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { PING_KINDS, reactionActivityKey } from "../../../activityKinds";
import type { ActivityItem, Channel, Message, User } from "../../../api";
import {
  fetchActivityBadgeCounts,
  fetchActivityFeedEntries,
  fetchChannelLastRead,
  fetchHistory,
  fetchHistoryAround,
  fetchMessagesByIds,
  markActivityRead,
  resolveActivityEntry,
} from "../../../api";
import type { ThreadRef } from "../types";
import { createActivityFeedLoad } from "./activity/activityFeedLoad";
import { createActivityReadState } from "./activity/activityReadState";
import { createActivityReadSync } from "./activity/activityReadSync";
import { createRecentReactionFlash } from "./activity/recentReaction";

type ActivityApi = {
  fetchActivityBadgeCounts: typeof fetchActivityBadgeCounts;
  fetchActivityFeedEntries: typeof fetchActivityFeedEntries;
  fetchChannelLastRead: typeof fetchChannelLastRead;
  fetchHistory: typeof fetchHistory;
  fetchHistoryAround: typeof fetchHistoryAround;
  fetchMessagesByIds: typeof fetchMessagesByIds;
  markActivityRead: typeof markActivityRead;
  resolveActivityEntry: typeof resolveActivityEntry;
};

const DEFAULT_ACTIVITY_API: ActivityApi = {
  fetchActivityBadgeCounts,
  fetchActivityFeedEntries,
  fetchChannelLastRead,
  fetchHistory,
  fetchHistoryAround,
  fetchMessagesByIds,
  markActivityRead,
  resolveActivityEntry,
};

export function createActivitySlice(
  deps: {
    cacheResolvedMessages?: (messages: Map<string, Message>) => void;
    channels?: () => readonly Channel[];
    channelsInActivity?: () => boolean;
    currentUser: () => User | undefined;
    isBotUser?: (userId: string) => boolean;
    lastReadByChannel: Record<string, number>;
    notifyAllChannelIds?: () => readonly string[];
    reactionMessageFor?: (channelId: string, ts: string) => Message | undefined;
    setLastReadByChannel: (channelId: string, ts: number) => void;
    clearChannelUnread: (channelId: string) => void;
    syncChannelRead: (channelId: string, ts: string) => Promise<boolean>;
    syncThreadRead: (channelId: string, threadTs: string, ts: string) => Promise<boolean>;
    visibleThreads?: () => ThreadRef[];
  },
  apiOverrides: Partial<ActivityApi> = {},
) {
  const api = { ...DEFAULT_ACTIVITY_API, ...apiOverrides };
  const [activityItems, setActivityItems] = createStore<ActivityItem[]>([]);
  const activityReadSync = createActivityReadSync(deps.syncChannelRead);
  const {
    activityItemReadState,
    backfillMissingReadCursors,
    hasUnreadActivity,
    isActivityItemUnread,
    markActivityItemsRead,
    setGatewayActivityBadgeCounts,
    unreadActivityCount,
    unreadPingCount,
  } = createActivityReadState({
    activityItems,
    activityReadSync,
    clearChannelUnread: deps.clearChannelUnread,
    fetchActivityBadgeCounts: api.fetchActivityBadgeCounts,
    fetchChannelLastRead: api.fetchChannelLastRead,
    lastReadByChannel: deps.lastReadByChannel,
    markActivityRead: api.markActivityRead,
    pingKinds: PING_KINDS,
    setActivityItems,
    setLastReadByChannel: deps.setLastReadByChannel,
    syncThreadRead: deps.syncThreadRead,
  });

  createEffect(() => {
    const open = deps.visibleThreads?.();
    if (!open?.length) return;
    const openKeys = new Set(open.map((t) => `${t.channelId}:${t.ts}`));
    const toMark = activityItems.filter(
      (item) =>
        item.kind === "thread_reply" &&
        item.threadTs &&
        openKeys.has(`${item.channelId}:${item.threadTs}`),
    );
    if (toMark.length) markActivityItemsRead(toMark);
  });

  const recentReactionFlash = createRecentReactionFlash();

  function pushActivity(item: ActivityItem) {
    if (item.kind === "reaction" && item.userId && deps.isBotUser?.(item.userId)) return;
    setActivityItems(
      produce((list) => {
        if (list.some((existing) => sameActivityItem(existing, item))) return;
        list.unshift(item);
        if (list.length > 300) list.length = 300;
      }),
    );
    if (item.kind === "reaction" && item.reactionName) recentReactionFlash.flash(item.reactionName);
  }

  function sameActivityItem(existing: ActivityItem, next: ActivityItem): boolean {
    if (existing.id === next.id) return true;
    const existingReaction = reactionActivityKey(existing);
    return !!existingReaction && existingReaction === reactionActivityKey(next);
  }

  const {
    activityHasMore,
    activityLoaded,
    activityLoading,
    activityLoadError,
    activityLoadingMore,
    activityLoadMoreError,
    ensureActivityLoaded,
    loadMoreActivity,
    requestActivityRefresh,
  } = createActivityFeedLoad({
    activityItems,
    backfillMissingReadCursors,
    cacheResolvedMessages: deps.cacheResolvedMessages,
    channels: deps.channels,
    channelsInActivity: deps.channelsInActivity,
    currentUser: deps.currentUser,
    fetchActivityFeedEntries: api.fetchActivityFeedEntries,
    fetchHistory: api.fetchHistory,
    fetchHistoryAround: api.fetchHistoryAround,
    fetchMessagesByIds: api.fetchMessagesByIds,
    isBotUser: deps.isBotUser,
    lastReadByChannel: deps.lastReadByChannel,
    notifyAllChannelIds: deps.notifyAllChannelIds,
    resolveActivityEntry: api.resolveActivityEntry,
    setActivityItems,
  });

  function isActivityItemReacted(item: ActivityItem): boolean {
    const me = deps.currentUser();
    if (!me) return false;
    const message = deps.reactionMessageFor?.(item.channelId, item.ts);
    return !!message?.reactions?.some((reaction) => reaction.users.includes(me.id));
  }

  return {
    activityHasMore,
    activityItems,
    activityItemReadState,
    activityLoaded,
    activityLoading,
    activityLoadError,
    activityLoadingMore,
    activityLoadMoreError,
    activityReadSyncError: activityReadSync.error,
    activityReadSyncPending: activityReadSync.isPending,
    ensureActivityLoaded,
    hasUnreadActivity,
    isActivityItemReacted,
    isActivityItemUnread,
    loadMoreActivity,
    markActivityItemsRead,
    pushActivity,
    recentReactionEmoji: recentReactionFlash.recentReactionEmoji,
    requestActivityRefresh,
    retryActivityReadSync: activityReadSync.retry,
    setGatewayActivityBadgeCounts,
    unreadActivityCount,
    unreadPingCount,
  };
}
