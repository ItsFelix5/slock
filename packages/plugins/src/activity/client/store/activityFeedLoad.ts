import type { Env } from "@slock/core";
import type { ActivityItem, ChannelId, FeedEntry, Message, Ts, User, UserId } from "@slock/types";
import { createSignal, createStore, onCleanup } from "solid-js";
import {
  channelPostKey,
  isOwnOrUnresolved,
  NO_CHANNEL,
  NO_USER,
  reactionActivityKey,
} from "../kinds";
import { createActivityFeedRefreshScheduler } from "./activityFeedRefresh";
import type { ActivityItems } from "./activityItems";
import { createEntryResolution } from "./entryResolution";

const LIVE_ACTIVITY_REFRESH_DELAY_MS = 250;

type FetchStatus = "idle" | "loading" | "error";

export function createActivityFeedLoad(deps: {
  items: ActivityItems;
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
}) {
  const { createEntryPusher, resolvePendingEntries } = createEntryResolution({
    cacheResolvedMessages: deps.cacheResolvedMessages,
    env: deps.env,
    fetchHistoryAround: deps.fetchHistoryAround,
    fetchMessagesByIds: deps.fetchMessagesByIds,
    isBotUser: deps.isBotUser,
    onReactionPushed: deps.onReactionPushed,
    resolveActivityEntry: deps.resolveActivityEntry,
    items: deps.items,
  });

  const [loadStatus, setLoadStatus] = createSignal<FetchStatus>("idle");
  const [moreStatus, setMoreStatus] = createSignal<FetchStatus>("idle");
  const [activityLoaded, setActivityLoaded] = createSignal(false);
  const [activityHasMore, setActivityHasMore] = createSignal(true);
  let fetching = false;
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
    if (fetching) return;
    const me = deps.currentUser();
    if (!me) return;
    fetching = true;
    setLoadStatus("loading");
    try {
      const { entries, nextCursor } = await deps.fetchActivityFeedEntries();
      activityFeedCursor = nextCursor;
      setActivityHasMore(!!nextCursor);
      const { seen, seenChannelPosts, seenReactions } = seenSetsFor(deps.items.list);
      const pending = entries.filter((entry) => !seen.has(entry.id));

      const knownTimes = new Map(deps.items.list.map((item) => [item.id, item.time]));
      const stale = entries.filter((entry) => entry.time > (knownTimes.get(entry.id) ?? Infinity));
      const { push, pushed } = createEntryPusher(me, seen, seenChannelPosts, seenReactions);
      await resolvePendingEntries(pending, seen, seenChannelPosts, push);
      if (stale.length) {
        const toFetch = stale.filter((entry) => entry.channelId !== NO_CHANNEL);
        const batch = await deps.fetchMessagesByIds(toFetch);
        if (batch.size) deps.cacheResolvedMessages?.(batch);
        deps.items.update((list) => {
          for (const entry of stale) {
            const index = list.findIndex((i) => i.id === entry.id);
            const known = list[index];
            if (!known) continue;
            const resolved = deps.resolveActivityEntry(entry, batch);
            if (resolved.time < known.time) continue;
            if (isOwnOrUnresolved(resolved, me)) {
              list.splice(index, 1);
              continue;
            }
            Object.assign(known, {
              ...resolved,
              text: resolved.text || known.text,
              userId: resolved.userId === NO_USER ? known.userId : resolved.userId,
            });
          }
          list.sort((a, b) => b.time - a.time);
        });
      }
      setActivityLoaded(true);
      setLoadStatus("idle");
      void deps.backfillMissingReadCursors([...deps.items.list, ...pushed]);
    } catch (err) {
      console.error("Failed to load activity", err);
      setLoadStatus("error");
    } finally {
      fetching = false;
    }
  }

  async function ensureActivityLoaded() {
    if (activityLoaded() || loadStatus() === "error") return;
    await refreshActivityFeed();
  }

  async function loadMoreActivity(types?: string, unreadOnly?: boolean) {
    const scopeKey = activityFeedScopeKey(types, unreadOnly);
    if (!activityLoaded() || fetching || !activityHasMoreFor(types, unreadOnly)) return;
    const me = deps.currentUser();
    if (!me) return;
    fetching = true;
    setMoreStatus("loading");
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
      if (scopeKey)
        setScopedActivityHasMore((scoped) => {
          scoped[scopeKey] = hasMore;
        });
      else setActivityHasMore(hasMore);
      const { seen, seenChannelPosts, seenReactions } = seenSetsFor(deps.items.list);
      const pending = entries.filter((entry) => !seen.has(entry.id));
      const { push, pushed } = createEntryPusher(me, seen, seenChannelPosts, seenReactions);
      await resolvePendingEntries(pending, seen, seenChannelPosts, push);
      setMoreStatus("idle");
      void deps.backfillMissingReadCursors([...deps.items.list, ...pushed]);
    } catch (err) {
      console.error("Failed to load more activity", err);
      setMoreStatus("error");
    } finally {
      fetching = false;
    }
  }

  const liveRefresh = createActivityFeedRefreshScheduler({
    delayMs: LIVE_ACTIVITY_REFRESH_DELAY_MS,
    env: deps.env,
    isLoading: () => fetching,
    refresh: refreshActivityFeed,
  });

  onCleanup(liveRefresh.cancel);
  const requestActivityRefresh = liveRefresh.request;

  return {
    activityHasMore: activityHasMoreFor,
    activityLoaded,
    activityLoading: () => loadStatus() === "loading",
    activityLoadError: () => loadStatus() === "error",
    activityLoadingMore: () => moreStatus() === "loading",
    activityLoadMoreError: () => moreStatus() === "error",
    ensureActivityLoaded,
    loadMoreActivity,
    requestActivityRefresh,
    retryActivityLoad: refreshActivityFeed,
  };
}
