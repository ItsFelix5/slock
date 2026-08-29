import type { ActivityItem, User } from "./api";

export const PING_KINDS = new Set<ActivityItem["kind"]>(["mention", "dm", "keyword", "other"]);

export function isPingingActivity(item: ActivityItem): boolean {
  return PING_KINDS.has(item.kind);
}

const OwnMessageFilteredKinds = new Set<ActivityItem["kind"]>(["channel_all", "thread_reply"]);
export function isOwnOrUnresolved(item: Pick<ActivityItem, "kind" | "userId">, me: User): boolean {
  return OwnMessageFilteredKinds.has(item.kind) && (!item.userId || item.userId === me.id);
}

export function reactionActivityKey(item: ActivityItem): string | undefined {
  if (!(item.kind === "reaction" && item.channelId && item.ts && item.reactionName && item.userId))
    return;
  return `${item.channelId}:${item.ts}:${item.reactionName}:${item.userId}`;
}

export function channelPostKey(channelId: string, ts: string): string {
  return `${channelId}:${ts}`;
}

export const GATEWAY_PING_COUNT_KEYS = new Set([
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
    .reduce((total, [, value]) => total + (Number(value) || 0), 0);
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
