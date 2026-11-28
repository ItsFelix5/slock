import { replyError } from "@slock/slack";
import { apiGet, mapVisibleMessages } from "@slock/slack/client";
import type { ChannelId, HistoryPage, RawMessage, Ts } from "@slock/types";

type HistoryReply = {
  has_more?: boolean;
  messages?: RawMessage[];
  pin_count?: number;
  response_metadata?: { next_cursor?: string };
};

export async function fetchHistoryPage(
  channelId: ChannelId,
  query: URLSearchParams,
): Promise<HistoryPage> {
  const data = await apiGet<HistoryReply>(`/api/channels/${channelId}/messages?${query}`);
  if (!data.ok) throw replyError(data, "conversations.history failed");
  return {
    hasMore: !!data.has_more,
    messages: mapVisibleMessages(data.messages ?? []).reverse(),
    nextCursor: data.response_metadata?.next_cursor || undefined,
    pinCount: data.pin_count,
  };
}

export function fetchHistoryAround(channelId: ChannelId, ts: Ts, limit = 28): Promise<HistoryPage> {
  const query = new URLSearchParams({
    inclusive: "true",
    latest: ts,
    limit: String(limit),
  });
  return fetchHistoryPage(channelId, query);
}
