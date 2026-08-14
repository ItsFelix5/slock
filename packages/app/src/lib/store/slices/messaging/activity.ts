import type { ActivityItem, Channel, FeedEntry, Message, User } from "@slock/slack-api";
import {
  fetchActivityBadgeCounts,
  fetchActivityFeedEntries,
  fetchChannelLastRead,
  fetchHistory,
  fetchHistoryAround,
  fetchMessagesByIds,
  markActivityRead,
  resolveActivityEntry,
} from "@slock/slack-api";
import { createMemo, createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import {
  createActivityFeedRefreshScheduler,
  gatewayActivityCountsSnapshot,
} from "./activity/activityFeedRefresh";
import { createActivityReadSync } from "./activity/activityReadSync";
import { fetchChannelActivityItems } from "./activity/channelActivity";
import { createRecentReactionFlash } from "./activity/recentReaction";

export const PING_KINDS = new Set<ActivityItem["kind"]>(["mention", "dm", "keyword", "other"]);
const GLOW_KINDS = new Set<ActivityItem["kind"]>([
  "thread_reply",
  "channel_mention",
  "usergroup_mention",
  "channel_all",
]);

const LIVE_ACTIVITY_REFRESH_DELAY_MS = 250;

export function isPingingActivity(item: ActivityItem): boolean {
  return PING_KINDS.has(item.kind);
}

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

type ActivityItemReadState = "pending" | "read" | "unread";

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
    lastReadByChannel: Record<string, number>;
    notifyAllChannelIds?: () => readonly string[];
    reactionMessageFor?: (channelId: string, ts: string) => Message | undefined;
    setLastReadByChannel: (channelId: string, ts: number) => void;
    clearChannelUnread: (channelId: string) => void;
    syncChannelRead: (channelId: string, ts: string) => Promise<boolean>;
    syncThreadRead: (channelId: string, threadTs: string, ts: string) => Promise<boolean>;
  },
  apiOverrides: Partial<ActivityApi> = {},
) {
  const api = { ...DEFAULT_ACTIVITY_API, ...apiOverrides };
  const [activityItems, setActivityItems] = createStore<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = createSignal(false);
  const [activityLoaded, setActivityLoaded] = createSignal(false);
  const [activityLoadError, setActivityLoadError] = createSignal(false);
  const [activityHasMore, setActivityHasMore] = createSignal(true);
  const [activityLoadingMore, setActivityLoadingMore] = createSignal(false);
  const [activityLoadMoreError, setActivityLoadMoreError] = createSignal(false);
  let activityFeedCursor: string | undefined;

  const scopedActivityFeedCursors = new Map<string, string | undefined>();
  const [scopedActivityHasMore, setScopedActivityHasMore] = createStore<Record<string, boolean>>(
    {},
  );

  function activityFeedScopeKey(types?: string, unreadOnly?: boolean): string | undefined {
    if (!(types || unreadOnly)) return;
    return `${types ?? ""}${unreadOnly ? "|unread" : ""}`;
  }

  function activityHasMoreFor(types?: string, unreadOnly?: boolean): boolean {
    const scopeKey = activityFeedScopeKey(types, unreadOnly);
    return scopeKey ? (scopedActivityHasMore[scopeKey] ?? true) : activityHasMore();
  }
  const [readActivityIds, setReadActivityIds] = createStore<Record<string, boolean>>({});
  const activityReadSync = createActivityReadSync(deps.syncChannelRead);
  const [gatewayActivityCount, setGatewayActivityCount] = createSignal<number>();
  let lastGatewayActivityCountsSnapshot: string | undefined;

  function setGatewayActivityBadgeCounts(activity: any): boolean {
    const nextSnapshot = gatewayActivityCountsSnapshot(activity);
    const changed = nextSnapshot !== lastGatewayActivityCountsSnapshot;
    lastGatewayActivityCountsSnapshot = nextSnapshot;
    if (activity && typeof activity === "object")
      setGatewayActivityCount(
        Object.values(activity).reduce<number>((total, value) => total + (Number(value) || 0), 0),
      );
    return changed;
  }

  const recentReactionFlash = createRecentReactionFlash();

  function pushActivity(item: ActivityItem) {
    setActivityItems(
      produce((list) => {
        if (list.some((existing) => sameActivityItem(existing, item))) return;
        list.unshift(item);
        if (list.length > 300) list.length = 300;
      }),
    );
    if (item.kind === "reaction" && item.reactionName) recentReactionFlash.flash(item.reactionName);
  }

  function reactionActivityKey(item: ActivityItem): string | undefined {
    if (
      !(item.kind === "reaction" && item.channelId && item.ts && item.reactionName && item.userId)
    )
      return;
    return `${item.channelId}:${item.ts}:${item.reactionName}:${item.userId}`;
  }

  function sameActivityItem(existing: ActivityItem, next: ActivityItem): boolean {
    if (existing.id === next.id) return true;
    const existingReaction = reactionActivityKey(existing);
    return !!existingReaction && existingReaction === reactionActivityKey(next);
  }

  async function resolvePendingEntries(
    pending: FeedEntry[],
    seen: Set<string>,
    seenChannelPosts: Set<string>,
    push: (entry: FeedEntry, batch?: Map<string, Message>) => void,
  ) {
    const needsMessage = (entry: FeedEntry) =>
      !!entry.channelId && entry.activityType !== "quietly_added_to_channel";
    for (const entry of pending) if (!needsMessage(entry)) push(entry);
    const unresolved = pending.filter(needsMessage);
    const toFetch = unresolved.filter((entry) => !!entry.channelId);

    await api.fetchMessagesByIds(toFetch, (batch) => {
      deps.cacheResolvedMessages?.(batch);
      for (const entry of toFetch)
        if (!seen.has(entry.id) && batch.has(`${entry.channelId}:${entry.ts}`)) push(entry, batch);
    });

    const unresolvedChannelEntries = toFetch.filter(
      (entry) =>
        entry.kind === "channel_all" &&
        !seen.has(entry.id) &&
        !seenChannelPosts.has(`${entry.channelId}:${entry.ts}`),
    );
    const historyResults = await Promise.allSettled(
      unresolvedChannelEntries.map(async (entry) => ({
        entry,
        page: await api.fetchHistoryAround(entry.channelId, entry.ts, 1),
      })),
    );
    for (const result of historyResults) {
      if (result.status === "rejected") continue;
      const { entry, page } = result.value;
      const message = page.messages.find((candidate) => candidate.ts === entry.ts);
      if (!message) continue;
      const batch = new Map([[`${entry.channelId}:${entry.ts}`, message]]);
      deps.cacheResolvedMessages?.(batch);
      push(entry, batch);
    }
    for (const entry of unresolved) if (!seen.has(entry.id)) push(entry);
  }

  const OwnMessageFilteredKinds = new Set<ActivityItem["kind"]>(["channel_all", "thread_reply"]);
  function isOwnOrUnresolved(item: Pick<ActivityItem, "kind" | "userId">, me: User): boolean {
    return OwnMessageFilteredKinds.has(item.kind) && (!item.userId || item.userId === me.id);
  }
  function createEntryPusher(
    me: User,
    seen: Set<string>,
    seenChannelPosts: Set<string>,
    seenReactions: Set<string>,
  ) {
    const pushItem = (item: ActivityItem) => {
      const channelPostKey = `${item.channelId}:${item.ts}`;
      const reactionKey = reactionActivityKey(item);
      if (
        seen.has(item.id) ||
        (!!reactionKey && seenReactions.has(reactionKey)) ||
        isOwnOrUnresolved(item, me) ||
        (item.kind === "channel_all" && seenChannelPosts.has(channelPostKey))
      )
        return;
      seen.add(item.id);
      if (reactionKey) seenReactions.add(reactionKey);
      if (item.kind === "channel_all") seenChannelPosts.add(channelPostKey);
      setActivityItems(
        produce((list) => {
          list.push(item);
          list.sort((a, b) => b.time - a.time);
        }),
      );
    };
    const push = (entry: FeedEntry, batch?: Map<string, Message>) =>
      pushItem(api.resolveActivityEntry(entry, batch));
    return { push, pushItem };
  }

  async function refreshActivityFeed() {
    if (activityLoading()) return;
    const me = deps.currentUser();
    if (!me) return;
    const channels = deps.channels?.() ?? [];
    const notifyAllChannelIds = deps.notifyAllChannelIds?.() ?? [];
    const channelsInActivity = deps.channelsInActivity?.() ?? true;
    setActivityLoading(true);
    setActivityLoadError(false);
    try {
      const [{ entries, nextCursor }, channelItems] = await Promise.all([
        api.fetchActivityFeedEntries(),
        channelsInActivity
          ? fetchChannelActivityItems({
              channels,
              currentUserId: me.id,
              fetchHistory: api.fetchHistory,
              lastReadByChannel: deps.lastReadByChannel,
              notifyAllChannelIds,
            })
          : Promise.resolve([]),
      ]);
      activityFeedCursor = nextCursor;
      setActivityHasMore(!!nextCursor);
      const seen = new Set(activityItems.map((i) => i.id));
      const seenChannelPosts = new Set(
        activityItems
          .filter((item) => item.kind === "channel_all")
          .map((item) => `${item.channelId}:${item.ts}`),
      );
      const seenReactions = new Set(
        activityItems.map(reactionActivityKey).filter((key): key is string => !!key),
      );
      const addressedFeedPosts = new Set(
        entries
          .filter(
            (entry) =>
              entry.kind !== "reaction" &&
              (entry.kind !== "channel_all" || (!!entry.userId && !!entry.text)),
          )
          .map((entry) => `${entry.channelId}:${entry.ts}`),
      );
      const pending = entries.filter((entry) => !seen.has(entry.id));

      const stale = entries.filter((entry) => seen.has(entry.id));
      const { push, pushItem } = createEntryPusher(me, seen, seenChannelPosts, seenReactions);
      for (const item of channelItems)
        if (!addressedFeedPosts.has(`${item.channelId}:${item.ts}`)) pushItem(item);
      await resolvePendingEntries(pending, seen, seenChannelPosts, push);
      if (stale.length) {
        const toFetch = stale.filter((entry) => !!entry.channelId);
        const batch = await api.fetchMessagesByIds(toFetch);
        if (batch.size) deps.cacheResolvedMessages?.(batch);
        setActivityItems(
          produce((list) => {
            for (const entry of stale) {
              const index = list.findIndex((i) => i.id === entry.id);
              if (index === -1) continue;
              const resolved = api.resolveActivityEntry(entry, batch);
              if (resolved.time < list[index].time) continue;
              if (isOwnOrUnresolved(resolved, me)) {
                list.splice(index, 1);
                continue;
              }

              list[index] = {
                ...resolved,
                text: resolved.text || list[index].text,
                userId: resolved.userId || list[index].userId,
              };
            }
          }),
        );
      }
      setActivityLoaded(true);
      void backfillMissingReadCursors(activityItems);
    } catch (err) {
      console.error("Failed to load activity", err);
      setActivityLoadError(true);
    } finally {
      setActivityLoading(false);
    }
  }

  async function ensureActivityLoaded() {
    if (activityLoaded() && !activityLoadError()) return;
    await refreshActivityFeed();
  }

  async function loadMoreActivity(types?: string, unreadOnly?: boolean) {
    const scopeKey = activityFeedScopeKey(types, unreadOnly);
    if (
      !activityLoaded() ||
      activityLoading() ||
      activityLoadingMore() ||
      !activityHasMoreFor(types, unreadOnly)
    )
      return;
    const me = deps.currentUser();
    if (!me) return;
    setActivityLoadingMore(true);
    setActivityLoadMoreError(false);
    try {
      const cursor = scopeKey ? scopedActivityFeedCursors.get(scopeKey) : activityFeedCursor;
      const { entries, nextCursor } = await api.fetchActivityFeedEntries(
        50,
        cursor,
        types,
        unreadOnly,
      );
      if (scopeKey) scopedActivityFeedCursors.set(scopeKey, nextCursor);
      else activityFeedCursor = nextCursor;
      const hasMore = !!nextCursor && entries.length > 0;
      if (scopeKey) setScopedActivityHasMore(scopeKey, hasMore);
      else setActivityHasMore(hasMore);
      const seen = new Set(activityItems.map((i) => i.id));
      const seenChannelPosts = new Set(
        activityItems
          .filter((item) => item.kind === "channel_all")
          .map((item) => `${item.channelId}:${item.ts}`),
      );
      const seenReactions = new Set(
        activityItems.map(reactionActivityKey).filter((key): key is string => !!key),
      );
      const pending = entries.filter((entry) => !seen.has(entry.id));
      const { push } = createEntryPusher(me, seen, seenChannelPosts, seenReactions);
      await resolvePendingEntries(pending, seen, seenChannelPosts, push);
      void backfillMissingReadCursors(activityItems);
    } catch (err) {
      console.error("Failed to load more activity", err);
      setActivityLoadMoreError(true);
    } finally {
      setActivityLoadingMore(false);
    }
  }

  const requestActivityRefresh = createActivityFeedRefreshScheduler({
    delayMs: LIVE_ACTIVITY_REFRESH_DELAY_MS,
    isLoading: activityLoading,
    refresh: refreshActivityFeed,
  });

  function isActivityItemReacted(item: ActivityItem): boolean {
    const me = deps.currentUser();
    if (!me) return false;
    const message = deps.reactionMessageFor?.(item.channelId, item.ts);
    return !!message?.reactions?.some((reaction) => reaction.users.includes(me.id));
  }

  function activityItemReadState(item: ActivityItem): ActivityItemReadState {
    if (item.kind === "reaction") return "read";

    if (item.kind === "thread_reply" && item.unreadCount !== undefined)
      return item.unreadCount > 0 ? "unread" : "read";
    if (readActivityIds[item.id]) return "read";
    if (item.unread !== undefined) return item.unread ? "unread" : "read";
    const lastRead = deps.lastReadByChannel[item.channelId];
    if (item.channelId && lastRead === undefined) return "pending";
    return item.time > (lastRead ?? 0) ? "unread" : "read";
  }

  function isActivityItemUnread(item: ActivityItem): boolean {
    return activityItemReadState(item) === "unread";
  }

  const attemptedReadCursorBackfill = new Set<string>();

  function needsReadCursorBackfill(item: ActivityItem): boolean {
    if (!item.channelId) return false;
    if (item.kind === "reaction") return false;
    if (item.kind === "thread_reply" && item.unreadCount !== undefined) return false;
    return deps.lastReadByChannel[item.channelId] === undefined;
  }

  async function backfillMissingReadCursors(items: readonly ActivityItem[]) {
    const channelIds = new Set(items.filter(needsReadCursorBackfill).map((i) => i.channelId));
    const toFetch = [...channelIds].filter((id) => !attemptedReadCursorBackfill.has(id));
    for (const id of toFetch) attemptedReadCursorBackfill.add(id);
    await Promise.all(
      toFetch.map(async (channelId) => {
        try {
          deps.setLastReadByChannel(channelId, await api.fetchChannelLastRead(channelId));
        } catch {
          attemptedReadCursorBackfill.delete(channelId);
        }
      }),
    );
  }

  const unreadActivityCount = createMemo(() => activityItems.filter(isActivityItemUnread).length);

  const unreadPingCount = createMemo(
    () =>
      gatewayActivityCount() ??
      activityItems.filter((i) => PING_KINDS.has(i.kind) && isActivityItemUnread(i)).length,
  );
  const hasUnreadActivity = createMemo(
    () =>
      unreadPingCount() > 0 ||
      activityItems.some(
        (i) => (PING_KINDS.has(i.kind) || GLOW_KINDS.has(i.kind)) && isActivityItemUnread(i),
      ),
  );

  function markActivityItemsRead(items: readonly ActivityItem[]) {
    const latestTsByChannel = new Map<string, string>();
    const latestByThread = new Map<string, { channelId: string; threadTs: string; ts: string }>();
    for (const item of items) {
      if (activityItemReadState(item) === "read") continue;
      if (item.activityType === "quietly_added_to_channel") {
        void api
          .markActivityRead(item.activityType, item.feedTs ?? item.ts, item.id)
          .then(async () => {
            setReadActivityIds(item.id, true);
            setGatewayActivityBadgeCounts(await api.fetchActivityBadgeCounts());
          })
          .catch(() => {});
        continue;
      }
      setReadActivityIds(item.id, true);

      if (item.kind === "thread_reply" && item.unreadCount !== undefined)
        setActivityItems((i) => i.id === item.id, "unreadCount", 0);
      if (!item.channelId) continue;
      if (item.kind === "thread_reply" && item.threadTs) {
        const key = `${item.channelId}:${item.threadTs}`;
        const prev = latestByThread.get(key);
        if (!prev || parseFloat(item.ts) > parseFloat(prev.ts))
          latestByThread.set(key, {
            channelId: item.channelId,
            threadTs: item.threadTs,
            ts: item.ts,
          });
        continue;
      }
      const prev = latestTsByChannel.get(item.channelId);
      if (!prev || parseFloat(item.ts) > parseFloat(prev))
        latestTsByChannel.set(item.channelId, item.ts);
    }
    for (const [channelId, ts] of latestTsByChannel) {
      deps.setLastReadByChannel(channelId, parseFloat(ts) * 1000);

      deps.clearChannelUnread(channelId);
      void activityReadSync.request(channelId, ts).then(async (synced) => {
        if (!synced) return;
        try {
          setGatewayActivityBadgeCounts(await api.fetchActivityBadgeCounts());
        } catch {}
      });
    }

    for (const { channelId, threadTs, ts } of latestByThread.values())
      void deps.syncThreadRead(channelId, threadTs, ts);
  }

  return {
    activityHasMore: activityHasMoreFor,
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
