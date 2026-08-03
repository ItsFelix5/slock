// biome-ignore-all lint/style/noExcessiveLinesPerFile: One cohesive activity state machine coordinates feed loading, badges, and read state.
import type { ActivityItem, Channel, FeedEntry, Message, User } from "@slock/slack-api";
import {
  fetchActivityFeedEntries,
  fetchChannelLastRead,
  fetchHistory,
  fetchHistoryAround,
  fetchMessagesByIds,
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

// Which activity kinds represent a real, personally-addressed ping (direct
// @mention, DM, a custom pingword) versus ambient activity that's relevant
// but not aimed at you (thread replies, @channel/@here/usergroup broadcasts,
// a channel you've set to notify on every post) versus neither (reactions,
// app messages). Shared between the sidebar bell's two-tier urgency and the
// Activity view's own pinging/ambient filter and row styling, so the
// definition lives in one place.
export const PING_KINDS = new Set<ActivityItem["kind"]>([
  "mention",
  "dm",
  "keyword",
  "reminder",
  "channel_invite",
]);
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
  fetchActivityFeedEntries: typeof fetchActivityFeedEntries;
  fetchChannelLastRead: typeof fetchChannelLastRead;
  fetchHistory: typeof fetchHistory;
  fetchHistoryAround: typeof fetchHistoryAround;
  fetchMessagesByIds: typeof fetchMessagesByIds;
  resolveActivityEntry: typeof resolveActivityEntry;
};

const DEFAULT_ACTIVITY_API: ActivityApi = {
  fetchActivityFeedEntries,
  fetchChannelLastRead,
  fetchHistory,
  fetchHistoryAround,
  fetchMessagesByIds,
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
  // A category filter in the Activity view (e.g. just "Reactions") can pass
  // its Slack `types` wire value, and/or the real `unread_only` flag Slack's
  // own client sends for its "Unread" tab, to loadMoreActivity so pagination
  // only pulls matching pages instead of the whole feed. Each distinct
  // (types, unreadOnly) combo is its own paginated sequence, so it gets its
  // own cursor/more state, keyed by a combined scope string — never mixed
  // with activityFeedCursor/activityHasMore above (the default unfiltered
  // load used for badges/bell counts).
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
  const [reactedActivityIds, setReactedActivityIds] = createStore<Record<string, boolean>>({});
  const activityReadSync = createActivityReadSync(deps.syncChannelRead);
  const [engagements, setEngagements] = createSignal<
    { channelId: string; threadTs?: string; time: number; ts: string }[]
  >([]);
  // Gateway badge updates are aggregate counts, without the message data that
  // backs activityItems. Keep their notification state separately so a live
  // update still lights the bell before the activity feed has been fetched.
  const [gatewayPingCount, setGatewayPingCount] = createSignal(0);
  const [gatewayHasUnreadGlow, setGatewayHasUnreadGlow] = createSignal(false);
  let lastGatewayActivityCountsSnapshot: string | undefined;

  function setGatewayActivityBadgeCounts(activity: any): boolean {
    const count = (key: string) => Number(activity?.[key] ?? 0);
    const nextSnapshot = gatewayActivityCountsSnapshot(activity);
    const changed = nextSnapshot !== lastGatewayActivityCountsSnapshot;
    lastGatewayActivityCountsSnapshot = nextSnapshot;
    setGatewayPingCount(
      count("at_user") + count("dm") + count("keyword") + count("list_user_mentioned"),
    );
    setGatewayHasUnreadGlow(
      count("at_user_group") > 0 ||
        count("at_channel") > 0 ||
        count("at_everyone") > 0 ||
        count("channel") > 0 ||
        count("thread_v2") > 0,
    );
    return changed;
  }

  function pushActivity(item: ActivityItem) {
    setActivityItems(
      produce((list) => {
        list.unshift(item);
        if (list.length > 300) list.length = 300;
      }),
    );
  }

  // Shared by the initial load and loadMoreActivity: turns a page of raw feed
  // entries into pushed ActivityItems, resolving bodies via messages.list
  // (streamed in per batch) and falling back to a direct history lookup for
  // sparse notify-all bundles messages.list doesn't recognize.
  async function resolvePendingEntries(
    pending: FeedEntry[],
    seen: Set<string>,
    seenChannelPosts: Set<string>,
    push: (entry: FeedEntry, batch?: Map<string, Message>) => void,
  ) {
    // Reactions never carry a body or thread_ts from the feed, and other
    // kinds sometimes arrive without text — those need messages.list.
    // Anything the feed already fully describes renders now, so a slow
    // channel's fetch never holds up the whole view.
    const needsMessage = (entry: FeedEntry) =>
      entry.kind === "reaction" || !entry.text || !entry.userId;
    for (const entry of pending) if (!needsMessage(entry)) push(entry);
    const toFetch = pending.filter(needsMessage);
    // Stream the rest in as each messages.list batch resolves, then backfill
    // any whose message never came back (still worth a row from feed data).
    await api.fetchMessagesByIds(toFetch, (batch) => {
      deps.cacheResolvedMessages?.(batch);
      for (const entry of toFetch)
        if (!seen.has(entry.id) && batch.has(`${entry.channelId}:${entry.ts}`)) push(entry, batch);
    });
    // Sparse notify-all bundles sometimes fail to resolve through
    // messages.list even though they carry an exact channel + timestamp.
    // Fall back to the same inclusive history lookup used for permalink
    // navigation so the row gets its real author and body before we render
    // the final reference-only placeholder.
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
    for (const entry of toFetch) if (!seen.has(entry.id)) push(entry);
  }

  // "channel_all" (notify-on-every-post) and "thread_v2" (latest reply in a
  // thread you're in) can legitimately point at your own message — the feed
  // itself doesn't filter those out, so do it here rather than showing your
  // own posts back to you as activity.
  function createEntryPusher(me: User, seen: Set<string>, seenChannelPosts: Set<string>) {
    const pushItem = (item: ActivityItem) => {
      const channelPostKey = `${item.channelId}:${item.ts}`;
      if (
        seen.has(item.id) ||
        !item.userId ||
        item.userId === me.id ||
        (item.kind === "channel_all" && seenChannelPosts.has(channelPostKey))
      )
        return;
      seen.add(item.id);
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

  // Slack computes addressed activity (e.g. usergroup membership) in its feed.
  // The `channel` badge is aggregate-only, though, so notify-all channel posts
  // are hydrated from unread channel history alongside it. Safe to call
  // repeatedly since both sources are deduped; the in-flight guard avoids
  // overlapping fetches.
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
      const addressedFeedPosts = new Set(
        entries
          .filter(
            (entry) =>
              entry.kind !== "reaction" &&
              // A sparse channel bundle is only a reference. Let the richer
              // conversations.history row win instead of suppressing it
              // before messages.list has had a chance to hydrate the actor
              // and body.
              (entry.kind !== "channel_all" || (!!entry.userId && !!entry.text)),
          )
          .map((entry) => `${entry.channelId}:${entry.ts}`),
      );
      const pending = entries.filter((entry) => !seen.has(entry.id));
      const { push, pushItem } = createEntryPusher(me, seen, seenChannelPosts);
      for (const item of channelItems)
        if (!addressedFeedPosts.has(`${item.channelId}:${item.ts}`)) pushItem(item);
      await resolvePendingEntries(pending, seen, seenChannelPosts, push);
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

  // Walks one older page of the feed in via the cursor from the previous
  // page. Channel-post hydration only ever covers the current unread
  // window, so — unlike the initial load — older pages are feed entries only.
  // `types` narrows the request to one category's Slack wire type(s) (see
  // ACTIVITY_KIND_FEED_TYPES) — pass it when the Activity view has a category
  // filter active so paging in a narrow filter doesn't have to wade through
  // pages of other kinds just to find a few more matching rows. `unreadOnly`
  // mirrors Slack's own `unread_only` param for its "Unread" tab, so that
  // filter is server-side too instead of paging through read history that
  // never contributes a visible row.
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
      const pending = entries.filter((entry) => !seen.has(entry.id));
      const { push } = createEntryPusher(me, seen, seenChannelPosts);
      await resolvePendingEntries(pending, seen, seenChannelPosts, push);
      void backfillMissingReadCursors(activityItems);
    } catch (err) {
      console.error("Failed to load more activity", err);
      setActivityLoadMoreError(true);
    } finally {
      setActivityLoadingMore(false);
    }
  }

  // badge_counts_updated is noisy and Slack frequently sends identical
  // snapshots in a burst. The aggregate counts are enough to drive the bell;
  // only refresh the heavier feed after it has been opened once, and collapse
  // a burst into one trailing request. If another real count change arrives
  // while that request is running, keep exactly one follow-up refresh.
  const requestActivityRefresh = createActivityFeedRefreshScheduler({
    delayMs: LIVE_ACTIVITY_REFRESH_DELAY_MS,
    isLoaded: activityLoaded,
    isLoading: activityLoading,
    refresh: refreshActivityFeed,
  });

  function engagementCoversItem(
    engagement: { channelId: string; threadTs?: string; time: number; ts: string },
    item: ActivityItem,
  ) {
    if (engagement.channelId !== item.channelId) return false;
    if (engagement.ts === item.ts) return true;
    if (engagement.threadTs) {
      return (
        (item.threadTs === engagement.threadTs || item.ts === engagement.threadTs) &&
        item.time <= engagement.time
      );
    }
    return !item.threadTs && item.time <= engagement.time;
  }

  function isActivityItemReacted(item: ActivityItem): boolean {
    return (
      !!reactedActivityIds[item.id] ||
      engagements().some((entry) => engagementCoversItem(entry, item))
    );
  }

  function isActivityItemUnread(item: ActivityItem): boolean {
    // Reactions are a nice-to-know, not a ping — they never light the bell
    // (not in PING_KINDS/GLOW_KINDS), so they shouldn't sit in the "Unread"
    // filter forever either.
    if (item.kind === "reaction") return false;
    if (readActivityIds[item.id] || isActivityItemReacted(item)) return false;
    // A thread reply's read state lives on Slack's own per-thread subscription
    // cursor, not the parent channel's last_read — replying in a thread never
    // advances the channel's cursor, so comparing against lastReadByChannel
    // would keep a thread you've genuinely read (here or in real Slack)
    // marked unread forever. Slack hands back that cursor's result directly as
    // unreadCount on the bundle; trust it whenever the feed provides it.
    if (item.kind === "thread_reply" && item.unreadCount !== undefined) return item.unreadCount > 0;
    return item.time > (deps.lastReadByChannel[item.channelId] ?? 0);
  }

  // lastReadByChannel is only ever seeded from client.counts (bootstrap) and
  // live gateway events for channels those happen to cover. An old, closed DM
  // can drop out of client.counts entirely while activity.feed still returns
  // its history — leaving no cursor to compare against, so every such item
  // reads as "unread since the dawn of time". Once a page of activity items
  // loads, backfill a real cursor for any channel missing one so those rows
  // settle to their true read state instead of defaulting to unread.
  const attemptedReadCursorBackfill = new Set<string>();

  function needsReadCursorBackfill(item: ActivityItem): boolean {
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
          // Leave it out of the attempted set so the next feed refresh retries.
          attemptedReadCursorBackfill.delete(channelId);
        }
      }),
    );
  }

  const unreadActivityCount = createMemo(() => activityItems.filter(isActivityItemUnread).length);

  // Bell states: a plain dot for any unread activity that's relevant but not
  // personally directed (thread replies, @channel/@here/usergroup pings, channels
  // set to notify on every post), with a count only for things addressed
  // straight at the user (direct pings, DMs) — and nothing at all for reactions.
  const unreadPingCount = createMemo(() =>
    Math.max(
      gatewayPingCount(),
      activityItems.filter((i) => PING_KINDS.has(i.kind) && isActivityItemUnread(i)).length,
    ),
  );
  const hasUnreadActivity = createMemo(
    () =>
      unreadPingCount() > 0 ||
      gatewayHasUnreadGlow() ||
      activityItems.some(
        (i) => (PING_KINDS.has(i.kind) || GLOW_KINDS.has(i.kind)) && isActivityItemUnread(i),
      ),
  );

  function markActivityItemsRead(items: readonly ActivityItem[]) {
    const latestTsByChannel = new Map<string, string>();
    const latestByThread = new Map<string, { channelId: string; threadTs: string; ts: string }>();
    for (const item of items) {
      if (!isActivityItemUnread(item)) continue;
      setReadActivityIds(item.id, true);
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
      // Same clear used everywhere else a channel gets marked read, so the
      // sidebar's unread dot/mentions badge doesn't linger just because this
      // particular read happened via the Activity feed instead of visiting
      // the channel directly.
      deps.clearChannelUnread(channelId);
      void activityReadSync.request(channelId, ts);
    }
    // Thread replies carry their own subscription read cursor on Slack's
    // side — advancing the channel cursor above does nothing for them, so
    // this is the only thing that actually clears their unread state there.
    for (const { channelId, threadTs, ts } of latestByThread.values())
      void deps.syncThreadRead(channelId, threadTs, ts);
    // The gateway's aggregate activity_v2 counts only change on the next
    // badge_counts_updated push, which may never come (e.g. a thread reply's
    // badge isn't tied to any channel read cursor we advance above) — so once
    // everything actually loaded in the feed is read, drop the stale gateway
    // count too, or the bell dot outlives the unread it was lit for.
    if (
      !activityItems.some(
        (i) => (PING_KINDS.has(i.kind) || GLOW_KINDS.has(i.kind)) && isActivityItemUnread(i),
      )
    ) {
      setGatewayPingCount(0);
      setGatewayHasUnreadGlow(false);
    }
  }

  function markActivityItemsReacted(items: readonly ActivityItem[]) {
    for (const item of items) setReactedActivityIds(item.id, true);
  }

  function recordActivityEngagement(channelId: string, ts: string, threadTs?: string) {
    const time = parseFloat(ts) * 1000;
    if (!Number.isFinite(time)) return;
    setEngagements((current) => {
      const index = current.findIndex(
        (entry) => entry.channelId === channelId && entry.threadTs === threadTs,
      );
      if (index === -1) return [...current, { channelId, threadTs, time, ts }];
      if (current[index].time >= time) return current;
      return current.map((entry, i) => (i === index ? { channelId, threadTs, time, ts } : entry));
    });
  }

  return {
    activityHasMore: activityHasMoreFor,
    activityItems,
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
    markActivityItemsReacted,
    markActivityItemsRead,
    pushActivity,
    recordActivityEngagement,
    requestActivityRefresh,
    retryActivityReadSync: activityReadSync.retry,
    setGatewayActivityBadgeCounts,
    unreadActivityCount,
    unreadPingCount,
  };
}
