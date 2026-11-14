import type { ActivityItem, Message, User } from "@slock/types";
import { createStore } from "solid-js/store";
import {
  fetchChannelLastRead,
  fetchHistoryAround,
  fetchMessagesByIds,
} from "../../../slack/client/api";
import {
  archiveActivityItem,
  fetchActivityBadgeCounts,
  fetchActivityFeedEntries,
  markActivityRead,
  resolveActivityEntry,
} from "../fetch";
import { PING_KINDS } from "../kinds";
import { createActivityFeedLoad } from "./activityFeedLoad";
import { createActivityReadState } from "./activityReadState";
import { createActivityReadSync } from "./activityReadSync";
import { createRecentReactionFlash } from "./recentReaction";
import { createUnreadThreads } from "./unreadThreads";

type ActivityApi = {
  archiveActivityItem: typeof archiveActivityItem;
  fetchActivityBadgeCounts: typeof fetchActivityBadgeCounts;
  fetchActivityFeedEntries: typeof fetchActivityFeedEntries;
  fetchChannelLastRead: typeof fetchChannelLastRead;
  fetchHistoryAround: typeof fetchHistoryAround;
  fetchMessagesByIds: typeof fetchMessagesByIds;
  markActivityRead: typeof markActivityRead;
  resolveActivityEntry: typeof resolveActivityEntry;
};

const DEFAULT_ACTIVITY_API: ActivityApi = {
  archiveActivityItem,
  fetchActivityBadgeCounts,
  fetchActivityFeedEntries,
  fetchChannelLastRead,
  fetchHistoryAround,
  fetchMessagesByIds,
  markActivityRead,
  resolveActivityEntry,
};

export function createActivityStore(
  deps: {
    cacheResolvedMessages?: (messages: Map<string, Message>) => void;
    currentUser: () => User | undefined;
    isActivityViewOpen: () => boolean;
    isBotUser?: (userId: string) => boolean;
    lastReadByChannel: Record<string, number>;
    reactionMessageFor?: (channelId: string, ts: string) => Message | undefined;
    setLastReadByChannel: (channelId: string, ts: number) => void;
    clearChannelUnread: (channelId: string) => void;
    syncChannelRead: (channelId: string, ts: string) => Promise<boolean>;
    setThreadRead: (channelId: string, threadTs: string, ts: string) => Promise<boolean>;
    threadReadTsFor: (threadTs: string) => string | undefined;
  },
  apiOverrides: Partial<ActivityApi> = {},
) {
  const api = { ...DEFAULT_ACTIVITY_API, ...apiOverrides };
  const [activityItems, setActivityItems] = createStore<ActivityItem[]>([]);
  const [archivedIds, setArchivedIds] = createStore<Record<string, boolean>>({});
  const activityReadSync = createActivityReadSync(deps.syncChannelRead);
  const {
    activityItemReadState,
    backfillMissingReadCursors,
    hasUnreadActivity,
    isActivityItemUnread,
    markActivityItemsRead,
    markActivityItemUnread,
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
    setThreadRead: deps.setThreadRead,
    threadReadTsFor: deps.threadReadTsFor,
  });

  function removeActivityForMessage(channelId: string, ts: string): void {
    setActivityItems((items) =>
      items.filter((item) => item.channelId !== channelId || item.ts !== ts),
    );
  }

  const recentReactionFlash = createRecentReactionFlash();

  function applyThreadMarked(threadTs: string, unreadCount: number): void {
    setActivityItems((item) => item.kind === "thread_reply" && item.threadTs === threadTs, {
      unread: unreadCount > 0,
      unreadCount,
    });
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
    retryActivityLoad,
  } = createActivityFeedLoad({
    activityItems,
    backfillMissingReadCursors,
    cacheResolvedMessages: deps.cacheResolvedMessages,
    currentUser: deps.currentUser,
    fetchActivityFeedEntries: api.fetchActivityFeedEntries,
    fetchHistoryAround: api.fetchHistoryAround,
    fetchMessagesByIds: api.fetchMessagesByIds,
    isActivityViewOpen: deps.isActivityViewOpen,
    isBotUser: deps.isBotUser,
    onReactionPushed: recentReactionFlash.flash,
    resolveActivityEntry: api.resolveActivityEntry,
    setActivityItems,
  });

  function isActivityItemArchived(item: ActivityItem): boolean {
    if (archivedIds[item.id]) return true;
    const me = deps.currentUser();
    if (!me) return false;
    const message = deps.reactionMessageFor?.(item.channelId, item.ts);
    return !!message?.reactions?.some((reaction) => reaction.users.includes(me.id));
  }

  const unreadThreads = createUnreadThreads({ activityItems, isActivityItemUnread });

  const archivePending = new Set<string>();

  async function archiveActivity(item: ActivityItem): Promise<void> {
    if (isActivityItemArchived(item) || archivePending.has(item.id)) return;
    archivePending.add(item.id);
    try {
      await api.archiveActivityItem(
        item.activityType ?? item.kind,
        item.id,
        item.ts,
        item.linkedItemId,
      );
      setArchivedIds(item.id, true);
      markActivityItemsRead([item]);
    } finally {
      archivePending.delete(item.id);
    }
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
    applyThreadMarked,
    archiveActivity,
    ensureActivityLoaded,
    hasUnreadActivity,
    isActivityItemArchived,
    isActivityItemUnread,
    loadMoreActivity,
    markActivityItemsRead,
    markActivityItemUnread,
    recentReactionEmoji: recentReactionFlash.recentReactionEmoji,
    removeActivityForMessage,
    requestActivityRefresh,
    retryActivityLoad,
    retryActivityReadSync: activityReadSync.retry,
    setGatewayActivityBadgeCounts,
    unreadActivityCount,
    unreadPingCount,
    unreadThreads,
  };
}
