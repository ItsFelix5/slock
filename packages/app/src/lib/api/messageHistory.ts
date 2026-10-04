import type { HistoryPage, RawMessage } from "@slock/types";
import { apiGet, mapVisibleMessages } from "@slock/types";
import { fetchConversationView } from "./conversationView";

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
    const view = await fetchConversationView(channelId);
    return {
      hasMore: view.hasMore,
      messages: view.messages,
      nextCursor:
        view.hasMore && view.messages[0]?.ts ? `before:${view.messages[0].ts}` : undefined,
      view,
    };
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
  while (true) {
    const query = new URLSearchParams({ inclusive: "false", oldest: low });
    if (high) query.set("latest", high);
    const page = await fetchHistoryPage(channelId, query);
    const [first] = page.messages;
    if (page.hasMore && first) {
      high = midpointTs(low, first.ts);
      continue;
    }
    if (first) return { hasMore: high !== undefined, messages: page.messages };
    if (!high) return { hasMore: false, messages: [] };
    low = high;
    high = undefined;
  }
}
