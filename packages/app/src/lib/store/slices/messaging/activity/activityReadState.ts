import { createMemo, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { gatewayActivityCountsSnapshot, gatewayActivityPingCount } from "../../../../activityKinds";
import type { ActivityItem } from "../../../../api";

const GLOW_KINDS = new Set<ActivityItem["kind"]>([
  "thread_reply",
  "channel_mention",
  "usergroup_mention",
  "channel_all",
]);

type ActivityItemReadState = "pending" | "read" | "unread";

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
  syncThreadRead: (channelId: string, threadTs: string, ts: string) => Promise<boolean>;
}) {
  const [readActivityIds, setReadActivityIds] = createStore<Record<string, boolean>>({});
  const [gatewayActivityCount, setGatewayActivityCount] = createSignal<number>();
  let lastGatewayActivityCountsSnapshot: string | undefined;

  function setGatewayActivityBadgeCounts(activity: any): boolean {
    const nextSnapshot = gatewayActivityCountsSnapshot(activity);
    const changed = nextSnapshot !== lastGatewayActivityCountsSnapshot;
    lastGatewayActivityCountsSnapshot = nextSnapshot;
    if (activity && typeof activity === "object")
      setGatewayActivityCount(gatewayActivityPingCount(activity));
    return changed;
  }

  function activityItemReadState(item: ActivityItem): ActivityItemReadState {
    if (item.kind === "reaction") return "read";

    if (item.kind === "thread_reply" && item.unreadCount !== undefined)
      return item.unreadCount > 0 ? "unread" : "read";
    if (readActivityIds[item.id]) return "read";
    if (item.unread !== undefined) return item.unread ? "unread" : "read";
    if (item.kind !== "channel_all") return "pending";
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
    if (item.kind !== "channel_all") return false;
    return deps.lastReadByChannel[item.channelId] === undefined;
  }

  async function backfillMissingReadCursors(items: readonly ActivityItem[]) {
    const channelIds = new Set(items.filter(needsReadCursorBackfill).map((i) => i.channelId));
    const toFetch = [...channelIds].filter((id) => !attemptedReadCursorBackfill.has(id));
    for (const id of toFetch) attemptedReadCursorBackfill.add(id);
    await Promise.all(
      toFetch.map(async (channelId) => {
        try {
          deps.setLastReadByChannel(channelId, await deps.fetchChannelLastRead(channelId));
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
      if (item.activityType === "quietly_added_to_channel") {
        void deps
          .markActivityRead(item.activityType, item.feedTs ?? item.ts, item.id)
          .then(async () => {
            setReadActivityIds(item.id, true);
            setGatewayActivityBadgeCounts(await deps.fetchActivityBadgeCounts());
          })
          .catch(() => {});
        continue;
      }
      setReadActivityIds(item.id, true);

      if (item.kind === "thread_reply" && item.unreadCount !== undefined)
        deps.setActivityItems((i) => i.id === item.id, "unreadCount", 0);
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
      void deps.activityReadSync.request(channelId, ts).then(async (synced) => {
        if (!synced) return;
        try {
          setGatewayActivityBadgeCounts(await deps.fetchActivityBadgeCounts());
        } catch {}
      });
    }

    for (const { channelId, threadTs, ts } of latestByThread.values())
      void deps.syncThreadRead(channelId, threadTs, ts);
  }

  return {
    activityItemReadState,
    backfillMissingReadCursors,
    hasUnreadActivity,
    isActivityItemUnread,
    markActivityItemsRead,
    setGatewayActivityBadgeCounts,
    unreadActivityCount,
    unreadPingCount,
  };
}
