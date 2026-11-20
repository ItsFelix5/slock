import type { ActivityItem, ChannelId, Ts } from "@slock/types";
import { createMemo, createSignal, createStore } from "solid-js";
import { gatewayActivityCountsSnapshot, gatewayActivityPingCount, hasChannel } from "../kinds";
import type { ActivityItems } from "./activityItems";

const GLOW_KINDS = new Set<ActivityItem["kind"]>([
  "thread_reply",
  "channel_mention",
  "usergroup_mention",
  "channel_all",
]);

type ActivityItemReadState = "pending" | "read" | "unread";

function isMarkedViaActivityApi(
  item: ActivityItem,
): item is ActivityItem & { activityType: string } {
  return item.activityType === "quietly_added_to_channel" || item.activityType === "saved_reminder";
}

export function createActivityReadState(deps: {
  items: ActivityItems;
  activityReadSync: { request: (channelId: ChannelId, ts: Ts) => Promise<boolean> };
  clearChannelUnread: (channelId: ChannelId) => void;
  pingKinds: Set<ActivityItem["kind"]>;
  fetchActivityBadgeCounts: () => Promise<Record<string, number>>;
  fetchChannelLastRead: (channelId: ChannelId) => Promise<number>;
  lastReadByChannel: Record<string, number | undefined>;
  markActivityRead: (type: string, feedTs: Ts, key: string) => Promise<void>;
  setLastReadByChannel: (channelId: ChannelId, ts: number) => void;
  setThreadRead: (channelId: ChannelId, threadTs: Ts, ts: Ts) => Promise<boolean>;
  threadReadTsFor: (threadTs: Ts) => Ts | undefined;
}) {
  const [readActivityIds, setReadActivityIds] = createStore<Record<string, boolean | undefined>>(
    {},
  );
  const setActivityRead = (id: string, read: boolean | undefined) =>
    setReadActivityIds((state) => {
      if (read === undefined) delete state[id];
      else state[id] = read;
    });
  const setUnreadCount = (id: string, unreadCount: number) =>
    deps.items.patchWhere((item) => item.id === id, { unreadCount });
  const [gatewayActivityCount, setGatewayActivityCount] = createSignal<number>();
  let lastGatewayActivityCountsSnapshot: string | undefined;

  function setGatewayActivityBadgeCounts(activity: Record<string, number> | undefined): boolean {
    const nextSnapshot = gatewayActivityCountsSnapshot(activity);
    const changed = nextSnapshot !== lastGatewayActivityCountsSnapshot;
    lastGatewayActivityCountsSnapshot = nextSnapshot;
    if (activity) setGatewayActivityCount(gatewayActivityPingCount(activity));
    return changed;
  }

  function isBelowReadCursor(item: ActivityItem): boolean {
    if (!hasChannel(item) || isMarkedViaActivityApi(item)) return false;
    if (item.threadTs) {
      const threadCursor = deps.threadReadTsFor(item.threadTs);
      return threadCursor !== undefined && parseFloat(item.ts) <= parseFloat(threadCursor);
    }
    const cursor = deps.lastReadByChannel[item.channelId];
    return cursor !== undefined && parseFloat(item.ts) * 1000 <= cursor;
  }

  function activityItemReadState(item: ActivityItem): ActivityItemReadState {
    if (item.kind === "reaction") return "read";
    const override = readActivityIds[item.id];
    if (override !== undefined) return override ? "read" : "unread";
    if (isBelowReadCursor(item)) return "read";
    if (item.kind === "thread_reply" && item.unreadCount !== undefined)
      return item.unreadCount > 0 ? "unread" : "read";
    if (item.unread !== undefined) return item.unread ? "unread" : "read";
    return "pending";
  }

  function isActivityItemUnread(item: ActivityItem): boolean {
    return activityItemReadState(item) === "unread";
  }

  function markActivityItemUnread(item: ActivityItem) {
    if (item.kind === "thread_reply" && item.unreadCount !== undefined) {
      setUnreadCount(item.id, Math.max(1, item.unreadCount));
      return;
    }
    setActivityRead(item.id, false);
  }

  const attemptedReadCursorBackfill = new Set<string>();

  function needsReadCursorBackfill(item: ActivityItem): boolean {
    if (!hasChannel(item)) return false;
    return deps.lastReadByChannel[item.channelId] === undefined;
  }

  async function backfillMissingReadCursors(items: readonly ActivityItem[]) {
    const channelIds = new Set(items.filter(needsReadCursorBackfill).map((i) => i.channelId));
    const toFetch = [...channelIds].filter((id) => !attemptedReadCursorBackfill.has(id));
    for (const id of toFetch) attemptedReadCursorBackfill.add(id);
    await Promise.all(
      toFetch.map(async (channelId) => {
        try {
          const lastRead = await deps.fetchChannelLastRead(channelId);
          if (deps.lastReadByChannel[channelId] === undefined)
            deps.setLastReadByChannel(channelId, lastRead);
        } catch {
          attemptedReadCursorBackfill.delete(channelId);
        }
      }),
    );
  }

  const unreadActivityCount = createMemo(() => deps.items.list.filter(isActivityItemUnread).length);

  const unreadPingCount = createMemo(
    () =>
      gatewayActivityCount() ??
      deps.items.list.filter((i) => deps.pingKinds.has(i.kind) && isActivityItemUnread(i)).length,
  );
  const hasUnreadActivity = createMemo(
    () =>
      unreadPingCount() > 0 ||
      deps.items.list.some(
        (i) => (deps.pingKinds.has(i.kind) || GLOW_KINDS.has(i.kind)) && isActivityItemUnread(i),
      ),
  );

  function markActivityItemsRead(items: readonly ActivityItem[]) {
    const latestTsByChannel = new Map<ChannelId, Ts>();
    const latestByThread = new Map<string, { channelId: ChannelId; threadTs: Ts; ts: Ts }>();
    for (const item of items) {
      if (activityItemReadState(item) === "read") continue;
      if (isMarkedViaActivityApi(item)) {
        void deps
          .markActivityRead(item.activityType, item.feedTs ?? item.ts, item.id)
          .then(async () => {
            setActivityRead(item.id, true);
            setGatewayActivityBadgeCounts(await deps.fetchActivityBadgeCounts());
          })
          .catch(() => {});
        continue;
      }
      setActivityRead(item.id, hasChannel(item) ? undefined : true);

      if (item.kind === "thread_reply" && item.unreadCount !== undefined)
        setUnreadCount(item.id, 0);
      if (!hasChannel(item)) continue;
      if (item.threadTs) {
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
      if (parseFloat(ts) * 1000 <= (deps.lastReadByChannel[channelId] ?? 0)) continue;
      deps.setLastReadByChannel(channelId, parseFloat(ts) * 1000);

      deps.clearChannelUnread(channelId);
      void deps.activityReadSync.request(channelId, ts);
    }

    for (const { channelId, threadTs, ts } of latestByThread.values())
      void deps.setThreadRead(channelId, threadTs, ts);
  }

  return {
    activityItemReadState,
    backfillMissingReadCursors,
    hasUnreadActivity,
    isActivityItemUnread,
    markActivityItemsRead,
    markActivityItemUnread,
    setGatewayActivityBadgeCounts,
    unreadActivityCount,
    unreadPingCount,
  };
}
