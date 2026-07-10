import type { ActivityItem, Channel, Message, User } from "@slock/slack-api";
import { fetchMentions, markChannelRead } from "@slock/slack-api";
import { createMemo, createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";

const BROADCAST_RE = /<!(channel|here)>/;
const SUBTEAM_RE = /<!subteam\^([^|>]+)/;

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
  },
): ActivityItem | null {
  const text = msg.text ?? "";
  const time = parseFloat(ts) * 1000;
  const base = { channelId: channel, ts, userId: msg.userId, text, time, threadTs };

  if (text.includes(`<@${meId}>`)) return { ...base, id: `mn-${channel}-${ts}`, kind: "mention" };
  if (ctx.isDirectMessage(channel)) return { ...base, id: `dm-${channel}-${ts}`, kind: "dm" };

  const broadcast = text.match(BROADCAST_RE);
  if (broadcast)
    return {
      ...base,
      id: `cb-${channel}-${ts}`,
      kind: "channel_mention",
      broadcastRange: broadcast[1] as "channel" | "here",
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
}) {
  const [activityItems, setActivityItems] = createStore<ActivityItem[]>([]);
  const [activityLoaded, setActivityLoaded] = createSignal(false);

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
      const items = await fetchMentions(me.id);
      setActivityItems(
        produce((list) => {
          const seen = new Set(list.map((i) => i.id));
          for (const item of items) if (!seen.has(item.id)) list.push(item);
          list.sort((a, b) => b.time - a.time);
        }),
      );
    } catch {
      // search endpoint may not be available on every workspace; live events still populate this list
    }
  }

  function isActivityItemUnread(item: ActivityItem): boolean {
    return item.time > (deps.lastReadByChannel[item.channelId] ?? 0);
  }

  const unreadActivityCount = createMemo(() => activityItems.filter(isActivityItemUnread).length);

  // Bell states, from most to least urgent: a red dot for things addressed
  // straight at the user (direct pings, DMs), a plain glow for activity that's
  // relevant but not personally directed (thread replies, @channel/@here/usergroup
  // pings, channels set to notify on every post), and nothing at all for reactions.
  const PING_KINDS = new Set(["mention", "dm"]);
  const GLOW_KINDS = new Set([
    "thread_reply",
    "channel_mention",
    "usergroup_mention",
    "channel_all",
  ]);

  const hasUnreadPing = createMemo(() =>
    activityItems.some((i) => PING_KINDS.has(i.kind) && isActivityItemUnread(i)),
  );
  const hasUnreadGlow = createMemo(() =>
    activityItems.some((i) => GLOW_KINDS.has(i.kind) && isActivityItemUnread(i)),
  );

  // Advances each represented channel's *real* Slack read cursor up through the
  // latest activity item in it — the same effect as actually reading that
  // message in the channel, and (unlike a single "now" cutoff) never marks
  // later, still-unread messages in that channel as read.
  function markActivityRead() {
    const latestTsByChannel = new Map<string, string>();
    for (const item of activityItems) {
      if (!isActivityItemUnread(item)) continue;
      const prev = latestTsByChannel.get(item.channelId);
      if (!prev || parseFloat(item.ts) > parseFloat(prev))
        latestTsByChannel.set(item.channelId, item.ts);
    }
    for (const [channelId, ts] of latestTsByChannel) {
      deps.setLastReadByChannel(channelId, parseFloat(ts) * 1000);
      deps.patchChannel(channelId, { mentions: 0 });
      markChannelRead(channelId, ts).catch(() => {});
    }
  }

  // Same as markActivityRead but scoped to a single channel/ts — used by the
  // Activity view's per-row and "read & next" actions so marking one item
  // doesn't also clear other still-unread items in the same channel.
  function markActivityItemRead(channelId: string, ts: string) {
    const time = parseFloat(ts) * 1000;
    if (time <= (deps.lastReadByChannel[channelId] ?? 0)) return;
    deps.setLastReadByChannel(channelId, time);
    markChannelRead(channelId, ts).catch(() => {});
  }

  return {
    activityItems,
    ensureActivityLoaded,
    pushActivity,
    unreadActivityCount,
    hasUnreadPing,
    hasUnreadGlow,
    markActivityRead,
    markActivityItemRead,
    isActivityItemUnread,
  };
}
