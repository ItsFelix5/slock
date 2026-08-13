import type { Message } from "../../types";
import { HIDE_SUBTYPES, mapMessage } from "../mappers";
import { apiDelete, apiGet, apiPatch, apiPost, getWorkspaceDomain } from "../server";
import { type ConversationViewData, fetchConversationView } from "./conversationView";

export type HistoryPage = {
  messages: Message[];
  hasMore: boolean;
  nextCursor?: string;
  view?: ConversationViewData;
};

export type NewerHistoryPage = {
  hasMore: boolean;
  messages: Message[];
  nextOldest?: string;
};

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

export async function fetchReplies(
  channelId: string,
  threadTs: string,
  options?: { untilTs?: string },
): Promise<Message[]> {
  const messages: Message[] = [];
  let cursor: string | undefined;
  for (;;) {
    const query = new URLSearchParams({ limit: "200" });
    if (cursor) query.set("cursor", cursor);
    const data = await apiGet(`/api/channels/${channelId}/threads/${threadTs}/messages?${query}`);
    if (!data.ok) throw new Error(data.error ?? "conversations.replies failed");
    const raw: any[] = data.messages ?? [];
    messages.push(
      ...raw.filter((m) => m.type === "message" && !HIDE_SUBTYPES.has(m.subtype)).map(mapMessage),
    );
    const nextCursor = data.response_metadata?.next_cursor || undefined;
    if (!(data.has_more && nextCursor)) return messages;
    if (options?.untilTs && messages.some((m) => m.ts === options.untilTs)) return messages;
    cursor = nextCursor;
  }
}

export async function fetchPermalinkMessage(
  channelId: string,
  messageTs: string,
  threadTs: string,
): Promise<Message | undefined> {
  if (threadTs !== messageTs) {
    const replies = await fetchReplies(channelId, threadTs, {
      untilTs: messageTs,
    });
    return replies.find((m) => m.ts === messageTs);
  }
  const query = new URLSearchParams({
    inclusive: "true",
    latest: messageTs,
    limit: "1",
    oldest: messageTs,
  });
  const data = await apiGet(`/api/channels/${channelId}/messages?${query}`);
  if (!data.ok) throw new Error(data.error ?? "conversations.history failed");
  const messages: any[] = data.messages ?? [];
  const raw = messages.find((m) => m.ts === messageTs);
  return raw && !HIDE_SUBTYPES.has(raw.subtype) ? mapMessage(raw) : undefined;
}

export async function postMessage(
  channelId: string,
  text: string,
  threadTs?: string,
  blocks?: unknown,
  suppressUnfurl?: boolean,
) {
  const body: Record<string, unknown> = { text };
  if (threadTs) body.threadTs = threadTs;
  if (blocks) body.blocks = blocks;

  if (suppressUnfurl) body.suppressUnfurl = true;
  const data = await apiPost(`/api/channels/${channelId}/messages`, body);
  if (!data.ok) throw new Error(data.error ?? "chat.postMessage failed");
  return data;
}

export async function editMessage(channelId: string, ts: string, text: string, blocks?: unknown) {
  const body: Record<string, unknown> = { text };
  if (blocks) body.blocks = blocks;
  const data = await apiPatch(`/api/channels/${channelId}/messages/${ts}`, body);
  if (!data.ok) throw new Error(data.error ?? "chat.update failed");
  return data;
}

export async function broadcastReply(channelId: string, ts: string) {
  const data = await apiPatch(`/api/channels/${channelId}/messages/${ts}`, {
    replyBroadcast: true,
  });
  if (!data.ok) throw new Error(data.error ?? "chat.update failed");
  return data;
}

export async function deleteMessage(channelId: string, ts: string) {
  const data = await apiDelete(`/api/channels/${channelId}/messages/${ts}`);
  if (!data.ok) throw new Error(data.error ?? "chat.delete failed");
  return data;
}

export async function toggleReaction(channelId: string, ts: string, name: string, remove: boolean) {
  const path = `/api/messages/${channelId}/${ts}/reactions`;
  const data = remove ? await apiDelete(path, { name }) : await apiPost(path, { name });
  if (!data.ok) throw new Error(data.error ?? "reactions failed");
  return data;
}

export async function toggleSaved(channelId: string, ts: string, remove: boolean) {
  const path = `/api/messages/${channelId}/${ts}/save`;
  const data = remove ? await apiDelete(path) : await apiPost(path);
  if (!data.ok) throw new Error(data.error ?? "saved.add/remove failed");
  return data;
}

export async function markChannelRead(channelId: string, ts: string) {
  const data = await apiPost(`/api/channels/${channelId}/read`, { ts });
  if (!data.ok) throw new Error(data.error ?? "conversations.mark failed");
  return data;
}

export async function toggleStar(channelId: string, remove: boolean) {
  const path = `/api/channels/${channelId}/star`;
  const data = remove ? await apiDelete(path) : await apiPost(path);
  if (!data.ok) throw new Error(data.error ?? "stars.add/remove failed");
  return data;
}

export async function fetchPins(channelId: string): Promise<string[]> {
  const data = await apiGet(`/api/channels/${channelId}/pins`);
  if (!data.ok) throw new Error(data.error ?? "pins.list failed");
  const items: any[] = data.items ?? [];
  return items.map((it) => it.ts).filter(Boolean);
}

export interface PinnedMessage {
  message: Message | null;
  ts: string;
}

export async function fetchPinnedMessages(channelId: string): Promise<PinnedMessage[]> {
  const data = await apiGet(`/api/channels/${channelId}/pins`);
  if (!data.ok) throw new Error(data.error ?? "pins.list failed");
  const items: any[] = data.items ?? [];
  return items
    .filter((it) => it.message)
    .map((it) => ({ message: mapMessage(it.message), ts: it.ts }));
}

export async function togglePin(channelId: string, ts: string, remove: boolean) {
  const path = `/api/messages/${channelId}/${ts}/pin`;
  const data = remove ? await apiDelete(path) : await apiPost(path);
  if (!data.ok) throw new Error(data.error ?? "pins.add/remove failed");
  return data;
}

export async function getPermalink(
  channelId: string,
  ts: string,
  threadTs?: string,
): Promise<string | null> {
  try {
    const domain = await getWorkspaceDomain();
    const base = `https://${domain}/archives/${channelId}/p${ts.replace(".", "")}`;
    return threadTs && threadTs !== ts ? `${base}?thread_ts=${threadTs}&cid=${channelId}` : base;
  } catch (err) {
    console.error("Failed to resolve workspace domain for permalink", err);
    return null;
  }
}

export async function addReminder(text: string, time: string) {
  const data = await apiPost("/api/reminders", { text, time });
  if (!data.ok) throw new Error(data.error ?? "reminders.add failed");
  return data;
}

export async function addMessageReminder(channelId: string, ts: string, dateDue: number) {
  const data = await apiPost("/api/reminders", { channelId, dateDue, ts });
  if (!data.ok) throw new Error(data.error ?? "reminders.add failed");
  return data;
}

export interface SearchResult {
  channelId: string;
  channelName: string;
  text: string;
  threadTs?: string;
  ts: string;
  userId: string;
}

export async function searchMessages(
  query: string,
  opts?: { sort?: "score" | "timestamp"; sortDir?: "asc" | "desc" },
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ query });
  if (opts?.sort) params.set("sort", opts.sort);
  if (opts?.sortDir) params.set("sortDir", opts.sortDir);
  const data = await apiGet(`/api/search/messages?${params}`);
  if (!data.ok) throw new Error(data.error ?? "search.messages failed");
  return data.results ?? [];
}

export async function fetchSearchAutocomplete(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  const data = await apiGet(`/api/search/autocomplete?query=${encodeURIComponent(query)}`);
  if (!data.ok) return [];
  return data.suggestions ?? [];
}
