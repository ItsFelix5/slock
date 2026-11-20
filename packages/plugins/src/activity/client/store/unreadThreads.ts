import type { ActivityItem, ChannelId, Ts } from "@slock/types";
import { createMemo } from "solid-js";

const NONE: ActivityItem[] = [];

export function createUnreadThreads(deps: {
  activityItems: readonly ActivityItem[];
  isActivityItemUnread: (item: ActivityItem) => boolean;
}) {
  const byChannel = createMemo(() => {
    const latest = new Map<ChannelId, Map<Ts, ActivityItem>>();
    for (const item of deps.activityItems) {
      if (item.kind !== "thread_reply" || !item.threadTs || !deps.isActivityItemUnread(item))
        continue;
      const threads = latest.get(item.channelId) ?? new Map<Ts, ActivityItem>();
      latest.set(item.channelId, threads);
      const current = threads.get(item.threadTs);
      if (!current || item.time > current.time) threads.set(item.threadTs, item);
    }
    return new Map(
      [...latest].map(([channelId, threads]) => [
        channelId,
        [...threads.values()].sort((a, b) => b.time - a.time),
      ]),
    );
  });
  return (channelId: ChannelId) => byChannel().get(channelId) ?? NONE;
}
