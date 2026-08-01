import type { ActivityItem, Channel, HistoryPage } from "@slock/slack-api";

export async function fetchChannelActivityItems({
  channels,
  currentUserId,
  fetchHistory,
  lastReadByChannel,
  notifyAllChannelIds,
}: {
  channels: readonly Channel[];
  currentUserId: string;
  fetchHistory: (channelId: string) => Promise<HistoryPage>;
  lastReadByChannel: Record<string, number>;
  notifyAllChannelIds: readonly string[];
}): Promise<ActivityItem[]> {
  const notifyAll = new Set(notifyAllChannelIds);
  const targets = channels.filter((channel) => {
    if (!notifyAll.has(channel.id)) return false;
    return channel.unread || (channel.lastActivity ?? 0) > (lastReadByChannel[channel.id] ?? 0);
  });
  const pages = await Promise.allSettled(
    targets.map(async (channel) => ({ channel, page: await fetchHistory(channel.id) })),
  );

  return pages.flatMap((result) => {
    if (result.status === "rejected") return [];
    const { channel, page } = result.value;
    const lastRead = lastReadByChannel[channel.id] ?? 0;
    return page.messages
      .filter((message) => {
        const time = parseFloat(message.ts) * 1_000;
        return (
          Number.isFinite(time) &&
          time > lastRead &&
          !!message.userId &&
          message.userId !== currentUserId
        );
      })
      .map((message) => ({
        channelId: channel.id,
        id: `channel:${channel.id}:${message.ts}`,
        kind: "channel_all" as const,
        text: message.text,
        threadTs: message.threadTs,
        time: parseFloat(message.ts) * 1_000,
        ts: message.ts,
        userId: message.userId,
      }));
  });
}
