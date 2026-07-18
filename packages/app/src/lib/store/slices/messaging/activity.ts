import type { ActivityItem, Channel, DirectMessage, Message, User } from "@slock/slack-api";
import { fetchActivityFeed, markChannelRead } from "@slock/slack-api";
import { createMemo, createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";

const BROADCAST_RE = /<!(channel|here)>/;
const SUBTEAM_RE = /<!subteam\^([^|>]+)/;

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

// Priority order matters: a direct @mention always wins over the channel's
// broader notification settings, down to "notify on every post" as the catch-all.
// Kept as a pure function (no store closure) since it's only ever invoked from
// the realtime message handler, which already has all the inputs on hand.
export function classifyIncomingActivity(
  channel: string,
  ts: string,
  msg: Message,
  meId: string,
  threadRelevant: boolean,
  threadTs: string | undefined,
  ctx: {
    isDirectMessage: (channelId: string) => boolean;
    isNotifyAll: (channelId: string) => boolean;
    matchingHighlightWord: (text: string) => string | undefined;
  },
): ActivityItem | null {
  const text = msg.text ?? "";
  const time = parseFloat(ts) * 1000;
  const base = { channelId: channel, text, threadTs, time, ts, userId: msg.userId };

  if (text.includes(`<@${meId}>`)) return { ...base, id: `mn-${channel}-${ts}`, kind: "mention" };
  if (ctx.isDirectMessage(channel)) return { ...base, id: `dm-${channel}-${ts}`, kind: "dm" };

  // A custom "pingword" — pings you like an @mention wherever it appears,
  // even in a channel you'd otherwise get no activity from at all.
  const matchedKeyword = ctx.matchingHighlightWord(text);
  if (matchedKeyword)
    return { ...base, id: `kw-${channel}-${ts}`, kind: "keyword", matchedKeyword };

  const broadcast = text.match(BROADCAST_RE);
  if (broadcast)
    return {
      ...base,
      broadcastRange: broadcast[1] as "channel" | "here",
      id: `cb-${channel}-${ts}`,
      kind: "channel_mention",
    };

  const subteam = text.match(SUBTEAM_RE);
  if (subteam)
    return {
      ...base,
      id: `ug-${channel}-${ts}`,
      kind: "usergroup_mention",
      usergroupId: subteam[1],
    };

  if (threadRelevant) return { ...base, id: `th-${channel}-${ts}`, kind: "thread_reply" };
  if (ctx.isNotifyAll(channel)) return { ...base, id: `ca-${channel}-${ts}`, kind: "channel_all" };

  return null;
}

export function createActivitySlice(deps: {
  currentUser: () => User | undefined;
  lastReadByChannel: Record<string, number>;
  setLastReadByChannel: (channelId: string, ts: number) => void;
  patchChannel: (id: string, patch: Partial<Channel>) => void;
  patchDm: (id: string, patch: Partial<DirectMessage>) => void;
}) {
  const [activityItems, setActivityItems] = createStore<ActivityItem[]>([]);
  const [activityLoaded, setActivityLoaded] = createSignal(false);
  const [readActivityIds, setReadActivityIds] = createStore<Record<string, boolean>>({});
  const [reactedActivityIds, setReactedActivityIds] = createStore<Record<string, boolean>>({});
  const [engagements, setEngagements] = createSignal<
    { channelId: string; threadTs?: string; time: number; ts: string }[]
  >([]);
  // Gateway badge updates are aggregate counts, without the message data that
  // backs activityItems. Keep their notification state separately so a live
  // update still lights the bell before the activity feed has been fetched.
  const [gatewayHasUnreadGlow, setGatewayHasUnreadGlow] = createSignal(false);
  const [gatewayHasUnreadPing, setGatewayHasUnreadPing] = createSignal(false);

  function setGatewayActivityBadgeCounts(activity: any) {
    const count = (key: string) => Number(activity?.[key] ?? 0) > 0;
    setGatewayHasUnreadPing(
      count("at_user") || count("dm") || count("keyword") || count("list_user_mentioned"),
    );
    setGatewayHasUnreadGlow(
      count("at_user_group") ||
        count("at_channel") ||
        count("at_everyone") ||
        count("channel") ||
        count("thread_v2"),
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

  async function ensureActivityLoaded() {
    if (activityLoaded()) return;
    setActivityLoaded(true);
    const me = deps.currentUser();
    if (!me) {
      setActivityLoaded(false);
      return;
    }
    try {
      const items = await fetchActivityFeed();
      setActivityItems(
        produce((list) => {
          const seen = new Set(list.map((i) => i.id));
          // "channel_all" (notify-on-every-post) and "thread_v2" (latest reply
          // in a thread you're in) can legitimately point at your own message
          // — the feed itself doesn't filter those out, so do it here rather
          // than showing your own posts back to you as activity.
          for (const item of items)
            if (!seen.has(item.id) && item.userId !== me.id) list.push(item);
          list.sort((a, b) => b.time - a.time);
        }),
      );
    } catch {
      // undocumented endpoint may not be available on every workspace; live events still populate this list
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
    if (readActivityIds[item.id] || isActivityItemReacted(item)) return false;
    return item.time > (deps.lastReadByChannel[item.channelId] ?? 0);
  }

  const unreadActivityCount = createMemo(() => activityItems.filter(isActivityItemUnread).length);

  // Bell states, from most to least urgent: a red dot for things addressed
  // straight at the user (direct pings, DMs), a plain glow for activity that's
  // relevant but not personally directed (thread replies, @channel/@here/usergroup
  // pings, channels set to notify on every post), and nothing at all for reactions.
  const hasUnreadPing = createMemo(
    () =>
      gatewayHasUnreadPing() ||
      activityItems.some((i) => PING_KINDS.has(i.kind) && isActivityItemUnread(i)),
  );
  const hasUnreadGlow = createMemo(
    () =>
      gatewayHasUnreadGlow() ||
      activityItems.some((i) => GLOW_KINDS.has(i.kind) && isActivityItemUnread(i)),
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
      if (channelId.startsWith("D")) deps.patchDm(channelId, { mentions: 0 });
      else deps.patchChannel(channelId, { mentions: 0 });
      markChannelRead(channelId, ts).catch(() => {});
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
    ensureActivityLoaded,
    hasUnreadGlow,
    hasUnreadPing,
    isActivityItemReacted,
    isActivityItemUnread,
    markActivityItemsReacted,
    markActivityItemsRead,
    pushActivity,
    recordActivityEngagement,
    setGatewayActivityBadgeCounts,
    unreadActivityCount,
  };
}
