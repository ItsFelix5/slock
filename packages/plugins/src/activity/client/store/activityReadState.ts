import type { ActivityItem } from "@slock/types";
import { createMemo, createSignal } from "solid-js";
import { createStore } from "solid-js";
import { gatewayActivityCountsSnapshot, gatewayActivityPingCount } from "../kinds";

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
  activityItems: ActivityItem[];
  activityReadSync: { request: (channelId: string, ts: string) => Promise<boolean> };
  clearChannelUnread: (channelId: string) => void;
  pingKinds: Set<ActivityItem["kind"]>;
  fetchActivityBadgeCounts: () => Promise<Record<string, number>>;
  fetchChannelLastRead: (channelId: string) => Promise<number>;
  lastReadByChannel: Record<string, number>;
  markActivityRead: (type: string, feedTs: string, key: string) => Promise<void>;
  setActivityItems: (
    predicate: (item: ActivityItem) => boolean,
    key: "unreadCount",
    value: number,
  ) => void;
  setLastReadByChannel: (channelId: string, ts: number) => void;
  setThreadRead: (channelId: string, threadTs: string, ts: string) => Promise<boolean>;
  threadReadTsFor: (threadTs: string) => string | undefined;
}) {
  const [readActivityIds, setReadActivityIds] = createStore<Record<string, boolean | undefined>>(
    {},
  );
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
    if (!item.channelId || isMarkedViaActivityApi(item)) return false;
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
      deps.setActivityItems((i) => i.id === item.id, "unreadCount", Math.max(1, item.unreadCount));
      return;
    }
    setReadActivityIds(item.id, false);
  }

  const attemptedReadCursorBackfill = new Set<string>();

  function needsReadCursorBackfill(item: ActivityItem): boolean {
    if (!item.channelId) return false;
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

  const unreadActivityCount = createMemo(
    () => deps.activityItems.filter(isActivityItemUnread).length,
  );

  const unreadPingCount = createMemo(
    () =>
      gatewayActivityCount() ??
      deps.activityItems.filter((i) => deps.pingKinds.has(i.kind) && isActivityItemUnread(i))
        .length,
  );
  const hasUnreadActivity = createMemo(
    () =>
      unreadPingCount() > 0 ||
      deps.activityItems.some(
        (i) => (deps.pingKinds.has(i.kind) || GLOW_KINDS.has(i.kind)) && isActivityItemUnread(i),
      ),
  );

  function markActivityItemsRead(items: readonly ActivityItem[]) {
    const latestTsByChannel = new Map<string, string>();
    const latestByThread = new Map<string, { channelId: string; threadTs: string; ts: string }>();
    for (const item of items) {
      if (activityItemReadState(item) === "read") continue;
      if (isMarkedViaActivityApi(item)) {
        void deps
          .markActivityRead(item.activityType, item.feedTs ?? item.ts, item.id)
          .then(async () => {
            setReadActivityIds(item.id, true);
            setGatewayActivityBadgeCounts(await deps.fetchActivityBadgeCounts());
          })
          .catch(() => {});
        continue;
      }
      setReadActivityIds(item.id, item.channelId ? undefined : true);

      if (item.kind === "thread_reply" && item.unreadCount !== undefined)
        deps.setActivityItems((i) => i.id === item.id, "unreadCount", 0);
      if (!item.channelId) continue;
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
