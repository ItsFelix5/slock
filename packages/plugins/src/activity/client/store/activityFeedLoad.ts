import { defined, type Env } from "@slock/core";
import type { ActivityItem, ChannelId, FeedEntry, Message, Ts, User, UserId } from "@slock/types";
import { createSignal, onCleanup } from "solid-js";
import { createStore, produce, type SetStoreFunction } from "solid-js";
import { channelPostKey, isOwnOrUnresolved, NO_CHANNEL, NO_USER, reactionActivityKey } from "../kinds";
import { createActivityFeedRefreshScheduler } from "./activityFeedRefresh";
import { createEntryResolution } from "./entryResolution";

const LIVE_ACTIVITY_REFRESH_DELAY_MS = 250;

export function createActivityFeedLoad(deps: {
  activityItems: ActivityItem[];
  cacheResolvedMessages?: (messages: Map<string, Message>) => void;
  currentUser: () => User | undefined;
  env: Env;
  backfillMissingReadCursors: (items: readonly ActivityItem[]) => Promise<void>;
  fetchActivityFeedEntries: (
    limit?: number,
    cursor?: string,
    types?: string,
    unreadOnly?: boolean,
  ) => Promise<{ entries: FeedEntry[]; nextCursor?: string }>;
  fetchHistoryAround: (
    channelId: ChannelId,
    ts: Ts,
    limit: number,
  ) => Promise<{ messages: Message[] }>;
  fetchMessagesByIds: (
    entries: { channelId: ChannelId; ts: Ts }[],
  ) => Promise<Map<string, Message>>;
  isBotUser?: (userId: UserId) => boolean;
  onReactionPushed?: (name: string) => void;
  resolveActivityEntry: (entry: FeedEntry, batch?: Map<string, Message>) => ActivityItem;
  setActivityItems: SetStoreFunction<ActivityItem[]>;
}) {
  const { createEntryPusher, resolvePendingEntries } = createEntryResolution({
    cacheResolvedMessages: deps.cacheResolvedMessages,
    env: deps.env,
    fetchHistoryAround: deps.fetchHistoryAround,
    fetchMessagesByIds: deps.fetchMessagesByIds,
    isBotUser: deps.isBotUser,
    onReactionPushed: deps.onReactionPushed,
    resolveActivityEntry: deps.resolveActivityEntry,
    setActivityItems: deps.setActivityItems,
  });

  const [activityLoading, setActivityLoading] = createSignal(false);
  const [activityLoaded, setActivityLoaded] = createSignal(false);
  const [activityLoadError, setActivityLoadError] = createSignal(false);
  const [activityHasMore, setActivityHasMore] = createSignal(true);
  const [activityLoadingMore, setActivityLoadingMore] = createSignal(false);
  const [activityLoadMoreError, setActivityLoadMoreError] = createSignal(false);
  const isFetching = () => activityLoading() || activityLoadingMore();
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
    if (isFetching()) return;
    const me = deps.currentUser();
    if (!me) return;
    setActivityLoading(true);
    setActivityLoadError(false);
    try {
      const { entries, nextCursor } = await deps.fetchActivityFeedEntries();
      activityFeedCursor = nextCursor;
      setActivityHasMore(!!nextCursor);
      const { seen, seenChannelPosts, seenReactions } = seenSetsFor(deps.activityItems);
      const pending = entries.filter((entry) => !seen.has(entry.id));

      const knownTimes = new Map(deps.activityItems.map((item) => [item.id, item.time]));
      const stale = entries.filter((entry) => entry.time > (knownTimes.get(entry.id) ?? Infinity));
      const { push } = createEntryPusher(me, seen, seenChannelPosts, seenReactions);
      await resolvePendingEntries(pending, seen, seenChannelPosts, push);
      if (stale.length) {
        const toFetch = stale.filter((entry) => entry.channelId !== NO_CHANNEL);
        const batch = await deps.fetchMessagesByIds(toFetch);
        if (batch.size) deps.cacheResolvedMessages?.(batch);
        deps.setActivityItems(
          produce((list) => {
            for (const entry of stale) {
              const index = list.findIndex((i) => i.id === entry.id);
              if (index === -1) continue;
              const resolved = deps.resolveActivityEntry(entry, batch);
              if (resolved.time < defined(list[index]).time) continue;
              if (isOwnOrUnresolved(resolved, me)) {
                list.splice(index, 1);
                continue;
              }

              Object.assign(defined(list[index]), {
                ...resolved,
                text: resolved.text || defined(list[index]).text,
                userId: resolved.userId === NO_USER ? defined(list[index]).userId : resolved.userId,
              });
            }
            list.sort((a, b) => b.time - a.time);
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
    if (activityLoaded() || activityLoadError()) return;
    await refreshActivityFeed();
  }

  async function loadMoreActivity(types?: string, unreadOnly?: boolean) {
    const scopeKey = activityFeedScopeKey(types, unreadOnly);
    if (!activityLoaded() || isFetching() || !activityHasMoreFor(types, unreadOnly)) return;
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

  const liveRefresh = createActivityFeedRefreshScheduler({
    delayMs: LIVE_ACTIVITY_REFRESH_DELAY_MS,
    env: deps.env,
    isLoading: isFetching,
    refresh: refreshActivityFeed,
  });

  onCleanup(liveRefresh.cancel);
  const requestActivityRefresh = liveRefresh.request;

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
    retryActivityLoad: refreshActivityFeed,
  };
}
