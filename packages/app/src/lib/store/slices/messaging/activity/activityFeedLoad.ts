import { createSignal } from "solid-js";
import { createStore, produce, type SetStoreFunction } from "solid-js/store";
import { channelPostKey, isOwnOrUnresolved, reactionActivityKey } from "../../../../activityKinds";
import type { ActivityItem, Channel, FeedEntry, HistoryPage, Message, User } from "../../../../api";
import { createActivityFeedRefreshScheduler } from "./activityFeedRefresh";
import { fetchChannelActivityItems } from "./channelActivity";
import { createEntryResolution } from "./entryResolution";

const LIVE_ACTIVITY_REFRESH_DELAY_MS = 250;

export function createActivityFeedLoad(deps: {
  activityItems: ActivityItem[];
  cacheResolvedMessages?: (messages: Map<string, Message>) => void;
  channels?: () => readonly Channel[];
  channelsInActivity?: () => boolean;
  currentUser: () => User | undefined;
  backfillMissingReadCursors: (items: readonly ActivityItem[]) => Promise<void>;
  fetchActivityFeedEntries: (
    limit?: number,
    cursor?: string,
    types?: string,
    unreadOnly?: boolean,
  ) => Promise<{ entries: FeedEntry[]; nextCursor?: string }>;
  fetchHistory: (channelId: string) => Promise<HistoryPage>;
  fetchHistoryAround: (
    channelId: string,
    ts: string,
    limit: number,
  ) => Promise<{ messages: Message[] }>;
  fetchMessagesByIds: (
    entries: { channelId: string; ts: string }[],
  ) => Promise<Map<string, Message>>;
  isBotUser?: (userId: string) => boolean;
  lastReadByChannel: Record<string, number>;
  notifyAllChannelIds?: () => readonly string[];
  resolveActivityEntry: (entry: FeedEntry, batch?: Map<string, Message>) => ActivityItem;
  setActivityItems: SetStoreFunction<ActivityItem[]>;
}) {
  const { createEntryPusher, resolvePendingEntries } = createEntryResolution({
    cacheResolvedMessages: deps.cacheResolvedMessages,
    fetchHistoryAround: deps.fetchHistoryAround,
    fetchMessagesByIds: deps.fetchMessagesByIds,
    isBotUser: deps.isBotUser,
    resolveActivityEntry: deps.resolveActivityEntry,
    setActivityItems: deps.setActivityItems,
  });

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

  function seenSetsFor(items: readonly ActivityItem[]) {
    const seen = new Set(items.map((i) => i.id));
    const seenChannelPosts = new Set(
      items
        .filter((item) => item.kind === "channel_all")
        .map((item) => channelPostKey(item.channelId, item.ts)),
    );
    const seenReactions = new Set(
      items.map(reactionActivityKey).filter((key): key is string => !!key),
    );
    return { seen, seenChannelPosts, seenReactions };
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
        deps.fetchActivityFeedEntries(),
        channelsInActivity
          ? fetchChannelActivityItems({
              channels,
              currentUserId: me.id,
              fetchHistory: deps.fetchHistory,
              lastReadByChannel: deps.lastReadByChannel,
              notifyAllChannelIds,
            })
          : Promise.resolve([]),
      ]);
      activityFeedCursor = nextCursor;
      setActivityHasMore(!!nextCursor);
      const { seen, seenChannelPosts, seenReactions } = seenSetsFor(deps.activityItems);
      const addressedFeedPosts = new Set(
        entries
          .filter(
            (entry) =>
              entry.kind !== "reaction" &&
              (entry.kind !== "channel_all" || (!!entry.userId && !!entry.text)),
          )
          .map((entry) => channelPostKey(entry.channelId, entry.ts)),
      );
      const pending = entries.filter((entry) => !seen.has(entry.id));

      const stale = entries.filter((entry) => seen.has(entry.id));
      const { push, pushItem } = createEntryPusher(me, seen, seenChannelPosts, seenReactions);
      for (const item of channelItems)
        if (!addressedFeedPosts.has(channelPostKey(item.channelId, item.ts))) pushItem(item);
      await resolvePendingEntries(pending, seen, seenChannelPosts, push);
      if (stale.length) {
        const toFetch = stale.filter((entry) => !!entry.channelId);
        const batch = await deps.fetchMessagesByIds(toFetch);
        if (batch.size) deps.cacheResolvedMessages?.(batch);
        deps.setActivityItems(
          produce((list) => {
            for (const entry of stale) {
              const index = list.findIndex((i) => i.id === entry.id);
              if (index === -1) continue;
              const resolved = deps.resolveActivityEntry(entry, batch);
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
      void deps.backfillMissingReadCursors(deps.activityItems);
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
      const { entries, nextCursor } = await deps.fetchActivityFeedEntries(
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
      const { seen, seenChannelPosts, seenReactions } = seenSetsFor(deps.activityItems);
      const pending = entries.filter((entry) => !seen.has(entry.id));
      const { push } = createEntryPusher(me, seen, seenChannelPosts, seenReactions);
      await resolvePendingEntries(pending, seen, seenChannelPosts, push);
      void deps.backfillMissingReadCursors(deps.activityItems);
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

  return {
    activityHasMore: activityHasMoreFor,
    activityLoaded,
    activityLoading,
    activityLoadError,
    activityLoadingMore,
    activityLoadMoreError,
    ensureActivityLoaded,
    loadMoreActivity,
    requestActivityRefresh,
  };
}
