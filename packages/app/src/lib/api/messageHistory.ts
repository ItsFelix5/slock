import type { HistoryPage, Message, NewerHistoryPage } from "@slock/types";
import { apiGet, HIDE_SUBTYPES, mapMessage } from "@slock/types";
import { fetchConversationView } from "./conversationView";

const MICROSECONDS_PER_DAY = 86_400_000_000n;

function processMessages(raw: any[]): Message[] {
  return raw
    .filter((m) => m.type === "message" && !HIDE_SUBTYPES.has(m.subtype))
    .map(mapMessage)
    .reverse();
}

function timestampToMicroseconds(ts: string): bigint {
  const [seconds = "0", fraction = ""] = ts.split(".");
  return BigInt(seconds) * 1_000_000n + BigInt(fraction.padEnd(6, "0").slice(0, 6));
}

function microsecondsToTimestamp(value: bigint): string {
  const seconds = value / 1_000_000n;
  const fraction = String(value % 1_000_000n).padStart(6, "0");
  return `${seconds}.${fraction}`;
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
  const data = await apiGet(`/api/channels/${channelId}/messages?${query}`);
  if (!data.ok) throw new Error(data.error ?? "conversations.history failed");
  return {
    hasMore: !!data.has_more,
    messages: processMessages(data.messages ?? []),
    nextCursor: data.response_metadata?.next_cursor || undefined,
  };
}

export async function fetchHistoryAround(
  channelId: string,
  ts: string,
  limit = 28,
): Promise<HistoryPage> {
  const query = new URLSearchParams({
    inclusive: "true",
    latest: ts,
    limit: String(limit),
  });
  const data = await apiGet(`/api/channels/${channelId}/messages?${query}`);
  if (!data.ok) throw new Error(data.error ?? "conversations.history failed");
  return {
    hasMore: !!data.has_more,
    messages: processMessages(data.messages ?? []),
    nextCursor: data.response_metadata?.next_cursor || undefined,
  };
}

export async function fetchHistoryNewer(
  channelId: string,
  oldest: string,
  limit = 60,
): Promise<NewerHistoryPage> {
  const oldestMicroseconds = timestampToMicroseconds(oldest);

  const liveEdgeMicroseconds = BigInt(Date.now() + 60_000) * 1_000n;
  const maximumSpan = liveEdgeMicroseconds - oldestMicroseconds;
  if (maximumSpan <= 0n) return { hasMore: false, messages: [] };

  let span = MICROSECONDS_PER_DAY < maximumSpan ? MICROSECONDS_PER_DAY : maximumSpan;
  let knownEmptySpan = 0n;
  let knownDenseSpan: bigint | undefined;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const upperMicroseconds = span < maximumSpan ? oldestMicroseconds + span : liveEdgeMicroseconds;
    const query = new URLSearchParams({
      inclusive: "false",
      latest: microsecondsToTimestamp(upperMicroseconds),
      limit: String(limit),
      oldest,
    });
    const data = await apiGet(`/api/channels/${channelId}/messages?${query}`);
    if (!data.ok) throw new Error(data.error ?? "conversations.history failed");
    const rawMessages: any[] = data.messages ?? [];

    if (data.has_more && span > 1n) {
      knownDenseSpan = span;
      span = (knownEmptySpan + span) / 2n;
      if (span <= knownEmptySpan) span = knownEmptySpan + 1n;
      continue;
    }
    if (rawMessages.length === 0 && span < maximumSpan) {
      knownEmptySpan = span;
      if (knownDenseSpan) {
        span = (span + knownDenseSpan + 1n) / 2n;
      } else {
        const doubled = span * 2n;
        span = doubled < maximumSpan ? doubled : maximumSpan;
      }
      continue;
    }

    return {
      hasMore: upperMicroseconds < liveEdgeMicroseconds || !!data.has_more,
      messages: processMessages(rawMessages),

      nextOldest: rawMessages[0]?.ts,
    };
  }

  throw new Error("Unable to find a bounded newer history page");
}
