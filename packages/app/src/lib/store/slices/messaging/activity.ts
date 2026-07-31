import type { ActivityItem, Message, User } from "@slock/slack-api";
import {
  fetchActivityFeedEntries,
  fetchMessagesByIds,
  resolveActivityEntry,
} from "@slock/slack-api";
import { createMemo, createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { createActivityReadSync } from "./activity/activityReadSync";

// Which activity kinds represent a real, personally-addressed ping (direct
// @mention, DM, a custom pingword) versus ambient activity that's relevant
// but not aimed at you (thread replies, @channel/@here/usergroup broadcasts,
// a channel you've set to notify on every post) versus neither (reactions,
// app messages). Shared between the sidebar bell's two-tier urgency and the
// Activity view's own pinging/ambient filter and row styling, so the
// definition lives in one place.
export const PING_KINDS = new Set<ActivityItem["kind"]>(["mention", "dm", "keyword"]);
const GLOW_KINDS = new Set<ActivityItem["kind"]>([
  "thread_reply",
  "channel_mention",
  "usergroup_mention",
  "channel_all",
]);

export function isPingingActivity(item: ActivityItem): boolean {
  return PING_KINDS.has(item.kind);
}

type ActivityApi = {
  fetchActivityFeedEntries: typeof fetchActivityFeedEntries;
  fetchMessagesByIds: typeof fetchMessagesByIds;
  resolveActivityEntry: typeof resolveActivityEntry;
};

const DEFAULT_ACTIVITY_API: ActivityApi = {
  fetchActivityFeedEntries,
  fetchMessagesByIds,
  resolveActivityEntry,
};

export function createActivitySlice(
  deps: {
    currentUser: () => User | undefined;
    lastReadByChannel: Record<string, number>;
    setLastReadByChannel: (channelId: string, ts: number) => void;
    clearChannelUnread: (channelId: string) => void;
    syncChannelRead: (channelId: string, ts: string) => Promise<boolean>;
  },
  apiOverrides: Partial<ActivityApi> = {},
) {
  const api = { ...DEFAULT_ACTIVITY_API, ...apiOverrides };
  const [activityItems, setActivityItems] = createStore<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = createSignal(false);
  const [activityLoaded, setActivityLoaded] = createSignal(false);
  const [activityLoadError, setActivityLoadError] = createSignal(false);
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

  function setGatewayActivityBadgeCounts(activity: any) {
    const count = (key: string) => Number(activity?.[key] ?? 0);
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
  }

  function pushActivity(item: ActivityItem) {
    setActivityItems(
      produce((list) => {
        list.unshift(item);
        if (list.length > 300) list.length = 300;
      }),
    );
  }

  // Activity items are exclusively sourced from this feed — Slack computes
  // membership (e.g. which usergroups you're actually in) server-side, which
  // a client-side guess at message text could never get right. Safe to call
  // repeatedly (on view mount and on every live badge update) since entries
  // are deduped by id; an in-flight guard just avoids overlapping fetches.
  async function ensureActivityLoaded() {
    if (activityLoading()) return;
    const me = deps.currentUser();
    if (!me) return;
    setActivityLoading(true);
    setActivityLoadError(false);
    try {
      const entries = await api.fetchActivityFeedEntries();
      const seen = new Set(activityItems.map((i) => i.id));
      const pending = entries.filter((entry) => !seen.has(entry.id));
      const push = (entry: (typeof pending)[number], batch?: Map<string, Message>) => {
        const item = api.resolveActivityEntry(entry, batch);
        // "channel_all" (notify-on-every-post) and "thread_v2" (latest reply
        // in a thread you're in) can legitimately point at your own message
        // — the feed itself doesn't filter those out, so do it here rather
        // than showing your own posts back to you as activity.
        if (seen.has(item.id) || !item.userId || item.userId === me.id) return;
        seen.add(item.id);
        setActivityItems(
          produce((list) => {
            list.push(item);
            list.sort((a, b) => b.time - a.time);
          }),
        );
      };
      // Reactions never carry a body or thread_ts from the feed, and other
      // kinds sometimes arrive without text — those need messages.list.
      // Anything the feed already fully describes renders now, so a slow
      // channel's fetch never holds up the whole view.
      const needsMessage = (entry: (typeof pending)[number]) =>
        entry.kind === "reaction" || !entry.text;
      for (const entry of pending) if (!needsMessage(entry)) push(entry);
      const toFetch = pending.filter(needsMessage);
      // Stream the rest in as each messages.list batch resolves, then backfill
      // any whose message never came back (still worth a row from feed data).
      await api.fetchMessagesByIds(toFetch, (batch) => {
        for (const entry of toFetch)
          if (!seen.has(entry.id) && batch.has(`${entry.channelId}:${entry.ts}`))
            push(entry, batch);
      });
      for (const entry of toFetch) if (!seen.has(entry.id)) push(entry);
      setActivityLoaded(true);
    } catch (err) {
      console.error("Failed to load activity", err);
      setActivityLoadError(true);
    } finally {
      setActivityLoading(false);
    }
  }

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
    return item.time > (deps.lastReadByChannel[item.channelId] ?? 0);
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
    for (const item of items) {
      if (!isActivityItemUnread(item)) continue;
      setReadActivityIds(item.id, true);
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
    activityItems,
    activityLoaded,
    activityLoading,
    activityLoadError,
    activityReadSyncError: activityReadSync.error,
    activityReadSyncPending: activityReadSync.isPending,
    ensureActivityLoaded,
    hasUnreadActivity,
    isActivityItemReacted,
    isActivityItemUnread,
    markActivityItemsReacted,
    markActivityItemsRead,
    pushActivity,
    recordActivityEngagement,
    retryActivityReadSync: activityReadSync.retry,
    setGatewayActivityBadgeCounts,
    unreadActivityCount,
    unreadPingCount,
  };
}
