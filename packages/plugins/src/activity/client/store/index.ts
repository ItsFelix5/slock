import { type Env, logUnknown } from "@slock/core";
import { createFlags } from "@slock/core/solid";
import { defineMutation } from "@slock/plugins/query/client/api";
import { fetchHistoryAround, fetchMessagesByIds } from "@slock/plugins/slack/client/api";
import { fetchChannelInfo } from "@slock/plugins/slack/client/api/channels";
import type {
  ActivityItem,
  ChannelId,
  Message,
  RawActivityFeedEntry,
  Ts,
  User,
  UserId,
} from "@slock/types";
import { createSignal } from "solid-js";
import { ACTIVITY_FEED_TYPES } from "../../protocol/feedTypes";
import {
  archiveActivityItem,
  fetchActivityBadgeCounts,
  fetchActivityFeedEntries,
  markActivityRead,
  parseFeedEntry,
  resolveActivityEntry,
} from "../fetch";
import { hasChannel, PING_KINDS } from "../kinds";
import { createActivityFeedLoad } from "./activityFeedLoad";
import { createActivityItems } from "./activityItems";
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
    ready: () => boolean;
    isBotUser?: (userId: UserId) => boolean;
    lastReadByChannel: Record<ChannelId, number | undefined>;
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
  const archivedIds = createFlags<string>();
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
    activityFeed,
    activityHasMore,
    activityLoaded,
    activityMore,
    applyLiveEntry,
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
    ready: deps.ready,
    onReactionPushed: recentReactionFlash.flash,
    resolveActivityEntry: api.resolveActivityEntry,
  });

  function applyActivityEvent(event: { entry?: RawActivityFeedEntry; subtype?: string }): void {
    const { entry, subtype } = event;
    if (subtype === "activity_deleted" && entry?.key) {
      items.removeWhere((item) => item.id === entry.key);
      return;
    }
    const type = entry?.item?.type;
    if (subtype === "activity_updated" && entry && type) {
      if (!ACTIVITY_FEED_TYPES.some((known) => known === type)) return;
      const parsed = parseFeedEntry(entry);
      if (parsed && hasChannel(parsed)) {
        applyLiveEntry(parsed);
        return;
      }
    }
    if (subtype !== "activity_invalidated") logUnknown("activity event", `${subtype} ${type}`);
    requestActivityRefresh();
  }

  function isActivityItemArchived(item: ActivityItem): boolean {
    if (archivedIds.has(item.id)) return true;
    const me = deps.currentUser();
    if (!me) return false;
    const message = deps.reactionMessageFor?.(item.channelId, item.ts);
    return !!message?.reactions?.some((reaction) => reaction.users.includes(me.id));
  }

  const unreadThreads = createUnreadThreads({ activityItems, isActivityItemUnread });

  const archive = defineMutation<ActivityItem, unknown>({
    key: (item) => item.id,
    mode: "single",
    onError: (error) => console.error("Failed to archive activity", error),
    onSuccess: (_result, item) => {
      archivedIds.set(item.id, true);
      markActivityItemsRead([item]);
    },
    run: (item) =>
      api.archiveActivityItem(item.activityType ?? item.kind, item.id, item.ts, item.linkedItemId),
  });
  const archiveActivity = (item: ActivityItem) =>
    isActivityItemArchived(item) ? Promise.resolve(false) : archive.run(item);

  return {
    activityFeed,
    activityHasMore,
    activityItems,
    activityItemReadState,
    activityLoaded,
    activityMore,
    activityReadSyncError: activityReadSync.error,
    activityReadSyncPending: activityReadSync.isPending,
    applyActivityEvent,
    applyThreadMarked,
    archiveActivity,
    currentRowKey,
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
    setCurrentRowKey: (key: string | undefined) => setCurrentRowKey(key),
    setGatewayActivityBadgeCounts,
    unreadActivityCount,
    unreadPingCount,
    unreadThreads,
  };
}

async function fetchChannelLastRead(channelId: ChannelId): Promise<number> {
  const { last_read } = await fetchChannelInfo(channelId);
  return (parseFloat(last_read ?? "") || 0) * 1000;
}
