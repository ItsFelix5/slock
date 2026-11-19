import type { Env } from "@slock/core";
import type { ActivityItem, ChannelId, Message, Ts, User, UserId } from "@slock/types";
import { createSignal, createStore } from "solid-js";
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
import { createActivityItems } from "./activityItems";
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
    clearChannelUnread: (channelId: ChannelId) => void;
    currentUser: () => User | undefined;
    env: Env;
    isBotUser?: (userId: UserId) => boolean;
    lastReadByChannel: Record<string, number | undefined>;
    reactionMessageFor?: (channelId: ChannelId, ts: Ts) => Message | undefined;
    setLastReadByChannel: (channelId: ChannelId, ts: number) => void;
    setThreadRead: (channelId: ChannelId, threadTs: Ts, ts: Ts) => Promise<boolean>;
    syncChannelRead: (channelId: ChannelId, ts: Ts) => Promise<boolean>;
    threadReadTsFor: (threadTs: Ts) => Ts | undefined;
  },
  apiOverrides: Partial<ActivityApi> = {},
) {
  const api = { ...DEFAULT_ACTIVITY_API, ...apiOverrides };
  const [currentRowKey, setCurrentRowKey] = createSignal<string>();
  const items = createActivityItems();
  const activityItems = items.list;
  const [archivedIds, setArchivedIds] = createStore<Record<string, boolean>>({});
  const activityReadSync = createActivityReadSync(deps.syncChannelRead);
  const {
    activityItemReadState,
    backfillMissingReadCursors,
    hasUnreadActivity,
    isActivityItemUnread,
    markActivityItemsRead,
    markActivityItemUnread,
    setCurrentRowKey,
    setGatewayActivityBadgeCounts,
    unreadActivityCount,
    unreadPingCount,
  } = createActivityReadState({
    activityReadSync,
    clearChannelUnread: deps.clearChannelUnread,
    fetchActivityBadgeCounts: api.fetchActivityBadgeCounts,
    fetchChannelLastRead: api.fetchChannelLastRead,
    items,
    lastReadByChannel: deps.lastReadByChannel,
    markActivityRead: api.markActivityRead,
    pingKinds: PING_KINDS,
    setLastReadByChannel: deps.setLastReadByChannel,
    setThreadRead: deps.setThreadRead,
    threadReadTsFor: deps.threadReadTsFor,
  });

  function removeActivityForMessage(channelId: ChannelId, ts: Ts): void {
    items.removeWhere((item) => item.channelId === channelId && item.ts === ts);
  }

  const recentReactionFlash = createRecentReactionFlash(deps.env);

  function applyThreadMarked(threadTs: Ts, unreadCount: number): void {
    items.patchWhere((item) => item.kind === "thread_reply" && item.threadTs === threadTs, {
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
    backfillMissingReadCursors,
    cacheResolvedMessages: deps.cacheResolvedMessages,
    currentUser: deps.currentUser,
    env: deps.env,
    fetchActivityFeedEntries: api.fetchActivityFeedEntries,
    fetchHistoryAround: api.fetchHistoryAround,
    fetchMessagesByIds: api.fetchMessagesByIds,
    isBotUser: deps.isBotUser,
    items,
    onReactionPushed: recentReactionFlash.flash,
    resolveActivityEntry: api.resolveActivityEntry,
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
      setArchivedIds((ids) => {
        ids[item.id] = true;
      });
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
    currentRowKey,
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
    setCurrentRowKey,
    setGatewayActivityBadgeCounts,
    unreadActivityCount,
    unreadPingCount,
    unreadThreads,
  };
}
