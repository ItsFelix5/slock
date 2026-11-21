import { parseChannelId, parseUserId } from "@slock/slack";
import type { ActivityItem, ChannelId, Ts, User } from "@slock/types";

export const NO_CHANNEL = parseChannelId("C000000000");
export const NO_USER = parseUserId("U000000000");

export const hasChannel = (item: Pick<ActivityItem, "channelId">) => item.channelId !== NO_CHANNEL;

export const PING_KINDS = new Set<ActivityItem["kind"]>(["mention", "dm", "keyword", "other"]);

const OwnMessageFilteredKinds = new Set<ActivityItem["kind"]>([
  "channel_all",
  "thread_reply",
  "dm",
]);
export function isOwnOrUnresolved(item: Pick<ActivityItem, "kind" | "userId">, me: User): boolean {
  return (
    OwnMessageFilteredKinds.has(item.kind) && (item.userId === NO_USER || item.userId === me.id)
  );
}

export function reactionActivityKey(item: ActivityItem): string | undefined {
  if (
    !(
      item.kind === "reaction" &&
      item.channelId !== NO_CHANNEL &&
      item.reactionName &&
      item.userId !== NO_USER
    )
  )
    return;
  return `${item.channelId}:${item.ts}:${item.reactionName}:${item.userId}`;
}

export function createPingCoverage(items: readonly ActivityItem[]) {
  const covered = new Set<string>();
  for (const { channelId, kind, threadTs, ts } of items) {
    if (kind === "thread_reply") covered.add(`thread:${channelId}:${threadTs ?? ts}`);
    if (kind === "channel_all") covered.add(`post:${channelId}:${ts}`);
  }
  return (item: ActivityItem) =>
    item.kind === "keyword" &&
    (covered.has(`post:${item.channelId}:${item.ts}`) ||
      covered.has(`thread:${item.channelId}:${item.threadTs ?? item.ts}`));
}

export function channelPostKey(channelId: ChannelId, ts: Ts): string {
  return `${channelId}:${ts}`;
}

const GATEWAY_PING_COUNT_KEYS = new Set([
  "at_user",
  "dm",
  "keyword",
  "list_user_mentioned",
  "at_user_group",
  "at_channel",
  "at_everyone",
  "channel",
  "thread_v2",
]);

export function gatewayActivityPingCount(activity: Record<string, number> | undefined): number {
  if (!activity) return 0;
  return Object.entries(activity)
    .filter(([key]) => GATEWAY_PING_COUNT_KEYS.has(key))
    .reduce((total, [, value]) => total + Math.max(0, Number(value) || 0), 0);
}

export function gatewayActivityCountsSnapshot(
  activity: Record<string, number> | undefined,
): string {
  if (!activity) return "";
  return Object.entries(activity)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${Number(value) || 0}`)
    .join(":");
}
