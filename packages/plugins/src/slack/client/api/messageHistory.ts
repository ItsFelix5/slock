import { defined } from "@slock/core";
import { apiGet, mapVisibleMessages } from "@slock/slack";
import type { HistoryPage, RawMessage } from "@slock/types";

type HistoryReply = {
  has_more?: boolean;
  messages?: RawMessage[];
  response_metadata?: { next_cursor?: string };
};

async function fetchHistoryPage(channelId: string, query: URLSearchParams): Promise<HistoryPage> {
  const data = await apiGet<HistoryReply>(`/api/channels/${channelId}/messages?${query}`);
  if (!data.ok) throw new Error(data.error ?? "conversations.history failed");
  return {
    hasMore: !!data.has_more,
    messages: mapVisibleMessages(data.messages ?? []).reverse(),
    nextCursor: data.response_metadata?.next_cursor || undefined,
  };
}

export async function fetchHistory(channelId: string, cursor?: string): Promise<HistoryPage> {
  if (!cursor) {
    const page = await fetchHistoryPage(channelId, new URLSearchParams());
    const oldest = page.messages[0]?.ts;
    return { ...page, nextCursor: page.hasMore && oldest ? `before:${oldest}` : undefined };
  }

  const query = new URLSearchParams();
  if (cursor.startsWith("before:")) {
    query.set("inclusive", "false");
    query.set("latest", cursor.slice("before:".length));
  } else {
    query.set("cursor", cursor);
  }
  return fetchHistoryPage(channelId, query);
}

export function fetchHistoryAround(
  channelId: string,
  ts: string,
  limit = 28,
): Promise<HistoryPage> {
  const query = new URLSearchParams({
    inclusive: "true",
    latest: ts,
    limit: String(limit),
  });
  return fetchHistoryPage(channelId, query);
}

function midpointTs(low: string, high: string) {
  return ((Number(low) + Number(high)) / 2).toFixed(6);
}

export async function fetchHistoryNewer(channelId: string, oldest: string): Promise<HistoryPage> {
  let low = oldest;
  let high: string | undefined;
  let tooBig: HistoryPage | undefined;
  while (true) {
    const query = new URLSearchParams({ inclusive: "false", oldest: low });
    if (high) query.set("latest", high);
    const page = await fetchHistoryPage(channelId, query);
    const [first] = page.messages;
    if (page.hasMore && first) tooBig = page;
    else if (first) return { hasMore: high !== undefined, messages: page.messages };
    else if (high && tooBig) low = high;
    else return { hasMore: false, messages: [] };
    const upper = defined(tooBig?.messages[0]).ts;
    high = midpointTs(low, upper);
    if (high === low || high === upper)
      return { hasMore: true, messages: defined(tooBig).messages };
  }
}
