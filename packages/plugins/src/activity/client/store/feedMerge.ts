import type { ActivityItem, FeedEntry, Message, User } from "@slock/types";
import { channelPostKey, isOwnOrUnresolved, NO_USER, reactionActivityKey } from "../kinds";

export function seenSetsFor(items: readonly ActivityItem[]) {
  const seen = new Set(items.map((item) => item.id));
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

export function staleEntries(
  entries: readonly FeedEntry[],
  items: readonly ActivityItem[],
): FeedEntry[] {
  const knownTimes = new Map(items.map((item) => [item.id, item.time]));
  return entries.filter((entry) => entry.time > (knownTimes.get(entry.id) ?? Infinity));
}

export function applyStaleEntries(
  list: ActivityItem[],
  stale: readonly FeedEntry[],
  resolve: (entry: FeedEntry, batch?: Map<string, Message>) => ActivityItem,
  batch: Map<string, Message>,
  me: User,
): void {
  for (const entry of stale) {
    const index = list.findIndex((item) => item.id === entry.id);
    const known = list[index];
    if (!known) continue;
    const resolved = resolve(entry, batch);
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
}
