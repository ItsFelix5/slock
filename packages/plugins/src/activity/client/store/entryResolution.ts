import type { Env } from "@slock/core";
import type { ActivityItem, ChannelId, FeedEntry, Message, Ts, User, UserId } from "@slock/types";
import { batch as solidBatch } from "solid-js";
import { produce, type SetStoreFunction } from "solid-js";
import { channelPostKey, isOwnOrUnresolved, NO_CHANNEL, reactionActivityKey } from "../kinds";

export function createEntryResolution(deps: {
  cacheResolvedMessages?: (messages: Map<string, Message>) => void;
  env: Env;
  fetchHistoryAround: (
    channelId: ChannelId,
    ts: Ts,
    limit: number,
  ) => Promise<{ messages: Message[] }>;
  fetchMessagesByIds: (
    entries: { channelId: ChannelId; ts: Ts }[],
    onBatch?: (batch: Map<string, Message>) => void,
  ) => Promise<Map<string, Message>>;
  isBotUser?: (userId: UserId) => boolean;
  onReactionPushed?: (name: string) => void;
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
      entry.channelId !== NO_CHANNEL && entry.activityType !== "quietly_added_to_channel";
    for (const entry of pending) if (!needsMessage(entry)) push(entry);
    const unresolved = pending.filter(needsMessage);
    const toFetch = unresolved;

    await deps.fetchMessagesByIds(toFetch, (batch) =>
      solidBatch(() => {
        deps.cacheResolvedMessages?.(batch);
        for (const entry of toFetch)
          if (!seen.has(entry.id) && batch.has(channelPostKey(entry.channelId, entry.ts)))
            push(entry, batch);
      }),
    );

    const unresolvedChannelEntries = toFetch.filter(
      (entry) =>
        entry.kind === "channel_all" &&
        !seen.has(entry.id) &&
        !seenChannelPosts.has(channelPostKey(entry.channelId, entry.ts)),
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
      const batch = new Map([[channelPostKey(entry.channelId, entry.ts), message]]);
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
      const postKey = channelPostKey(item.channelId, item.ts);
      const reactionKey = reactionActivityKey(item);
      if (
        seen.has(item.id) ||
        (!!reactionKey && seenReactions.has(reactionKey)) ||
        isOwnOrUnresolved(item, me) ||
        (item.kind === "channel_all" && seenChannelPosts.has(postKey)) ||
        (item.kind === "reaction" && !!item.userId && deps.isBotUser?.(item.userId))
      )
        return;
      seen.add(item.id);
      if (reactionKey) seenReactions.add(reactionKey);
      if (item.kind === "channel_all") seenChannelPosts.add(postKey);
      if (item.kind === "reaction" && item.reactionName && deps.env.now() - item.time < 10_000)
        deps.onReactionPushed?.(item.reactionName);
      deps.setActivityItems(
        produce((list) => {
          const olderIndex = list.findIndex((existing) => existing.time < item.time);
          list.splice(olderIndex === -1 ? list.length : olderIndex, 0, item);
        }),
      );
    };
    const push = (entry: FeedEntry, batch?: Map<string, Message>) =>
      pushItem(deps.resolveActivityEntry(entry, batch));
    return { push, pushItem };
  }

  return { createEntryPusher, resolvePendingEntries };
}
