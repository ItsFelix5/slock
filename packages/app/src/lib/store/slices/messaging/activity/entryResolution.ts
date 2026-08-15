import type { ActivityItem, FeedEntry, Message, User } from "@slock/slack-api";
import { produce, type SetStoreFunction } from "solid-js/store";

const OwnMessageFilteredKinds = new Set<ActivityItem["kind"]>(["channel_all", "thread_reply"]);
function isOwnOrUnresolved(item: Pick<ActivityItem, "kind" | "userId">, me: User): boolean {
  return OwnMessageFilteredKinds.has(item.kind) && (!item.userId || item.userId === me.id);
}

/** Turns raw activity-feed entries (which only carry channel/ts, not the actual message) into
 * pushable `ActivityItem`s - resolving their messages in one batched lookup, then falling back to
 * a per-entry history fetch for `channel_all` posts the batch lookup couldn't place. */
export function createEntryResolution(deps: {
  cacheResolvedMessages?: (messages: Map<string, Message>) => void;
  fetchHistoryAround: (
    channelId: string,
    ts: string,
    limit: number,
  ) => Promise<{ messages: Message[] }>;
  fetchMessagesByIds: (
    entries: { channelId: string; ts: string }[],
    onBatch?: (batch: Map<string, Message>) => void,
  ) => Promise<Map<string, Message>>;
  reactionActivityKey: (item: ActivityItem) => string | undefined;
  resolveActivityEntry: (entry: FeedEntry, batch?: Map<string, Message>) => ActivityItem;
  setActivityItems: SetStoreFunction<ActivityItem[]>;
}) {
  async function resolvePendingEntries(
    pending: FeedEntry[],
    seen: Set<string>,
    seenChannelPosts: Set<string>,
    push: (entry: FeedEntry, batch?: Map<string, Message>) => void,
  ) {
    const needsMessage = (entry: FeedEntry) =>
      !!entry.channelId && entry.activityType !== "quietly_added_to_channel";
    for (const entry of pending) if (!needsMessage(entry)) push(entry);
    const unresolved = pending.filter(needsMessage);
    const toFetch = unresolved.filter((entry) => !!entry.channelId);

    await deps.fetchMessagesByIds(toFetch, (batch) => {
      deps.cacheResolvedMessages?.(batch);
      for (const entry of toFetch)
        if (!seen.has(entry.id) && batch.has(`${entry.channelId}:${entry.ts}`)) push(entry, batch);
    });

    const unresolvedChannelEntries = toFetch.filter(
      (entry) =>
        entry.kind === "channel_all" &&
        !seen.has(entry.id) &&
        !seenChannelPosts.has(`${entry.channelId}:${entry.ts}`),
    );
    const historyResults = await Promise.allSettled(
      unresolvedChannelEntries.map(async (entry) => ({
        entry,
        page: await deps.fetchHistoryAround(entry.channelId, entry.ts, 1),
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
    for (const entry of unresolved) if (!seen.has(entry.id)) push(entry);
  }

  function createEntryPusher(
    me: User,
    seen: Set<string>,
    seenChannelPosts: Set<string>,
    seenReactions: Set<string>,
  ) {
    const pushItem = (item: ActivityItem) => {
      const channelPostKey = `${item.channelId}:${item.ts}`;
      const reactionKey = deps.reactionActivityKey(item);
      if (
        seen.has(item.id) ||
        (!!reactionKey && seenReactions.has(reactionKey)) ||
        isOwnOrUnresolved(item, me) ||
        (item.kind === "channel_all" && seenChannelPosts.has(channelPostKey))
      )
        return;
      seen.add(item.id);
      if (reactionKey) seenReactions.add(reactionKey);
      if (item.kind === "channel_all") seenChannelPosts.add(channelPostKey);
      deps.setActivityItems(
        produce((list) => {
          list.push(item);
          list.sort((a, b) => b.time - a.time);
        }),
      );
    };
    const push = (entry: FeedEntry, batch?: Map<string, Message>) =>
      pushItem(deps.resolveActivityEntry(entry, batch));
    return { push, pushItem };
  }

  return { createEntryPusher, isOwnOrUnresolved, resolvePendingEntries };
}
