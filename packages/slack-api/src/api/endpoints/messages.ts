// biome-ignore-all lint/style/useNamingConvention lint/style/noExcessiveLinesPerFile: Message operations share one public endpoint surface.
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

// `cursor` (from a prior page's nextCursor) fetches the next page of messages
// older than that page — conversations.history paginates backwards in time.
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

// Fetches a bounded page of messages ending at (and including) `ts`, the same
// `latest`+`inclusive` request Slack's own webapp makes when jumping to a
// permalinked message — not a zero-width `oldest === latest` lookup, which
// Slack's API doesn't reliably resolve to the exact message. The page doesn't
// need to connect to whatever's already loaded further down the channel; it's
// fine for the two to sit apart with a gap the reader can page through later.
export async function fetchHistoryAround(
  channelId: string,
  ts: string,
  limit = 28,
): Promise<HistoryPage> {
  const query = new URLSearchParams({ inclusive: "true", latest: ts, limit: String(limit) });
  const data = await apiGet(`/api/channels/${channelId}/messages?${query}`);
  if (!data.ok) throw new Error(data.error ?? "conversations.history failed");
  return {
    hasMore: !!data.has_more,
    messages: processMessages(data.messages ?? []),
    nextCursor: data.response_metadata?.next_cursor || undefined,
  };
}

// conversations.history always returns the newest messages inside a time
// range, even when `oldest` is supplied. To get the messages immediately
// after an old permalink (rather than jumping across the gap to today's
// tail), probe a bounded range and shrink it whenever it contains more than
// one page. Empty ranges grow exponentially, so long quiet periods still
// take only a handful of requests.
export async function fetchHistoryNewer(
  channelId: string,
  oldest: string,
  limit = 60,
): Promise<NewerHistoryPage> {
  const oldestMicroseconds = timestampToMicroseconds(oldest);
  // Leave a small allowance for client/server clock skew at the live edge.
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
      // Advance across hidden event subtypes too, otherwise an all-hidden
      // page would leave the next request stuck on the same boundary.
      nextOldest: rawMessages[0]?.ts,
    };
  }

  throw new Error("Unable to find a bounded newer history page");
}

// conversations.replies caps a single page at 200 replies. Threads longer
// than that need their later pages walked down via `cursor` — otherwise a
// reply past the first page (e.g. a Later/Activity jump into a busy thread)
// never loads and its highlight target silently fails to resolve. `untilTs`
// stops the walk as soon as that target shows up rather than always pulling
// the whole thread, since ThreadPanel renders replies unvirtualized.
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

// Fetches the single message a pasted permalink points at, for hover previews.
// Thread replies aren't visible to conversations.history, so those are looked
// up via conversations.replies on the thread root instead.
export async function fetchPermalinkMessage(
  channelId: string,
  messageTs: string,
  threadTs: string,
): Promise<Message | undefined> {
  if (threadTs !== messageTs) {
    const replies = await fetchReplies(channelId, threadTs, { untilTs: messageTs });
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
  // Slack's own link unfurl is all-or-nothing for the whole message — there's
  // no documented way to suppress just one link — so dismissing any preview
  // in the composer turns it off for the message as a whole.
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

// `chat.getPermalink` is blocked with `enterprise_is_restricted` on Enterprise
// Grid workspaces like this one, so the permalink is built locally instead —
// it's a plain, documented URL shape (workspace domain + channel + ts with
// its "." removed and a "p" prefix), no API call needed. `threadTs` (when the
// target is a reply within a thread) adds the same `thread_ts` query param
// Slack's own permalinks use, so opening the link deep-links into the thread
// instead of just the parent channel.
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

// Reminders tied to a specific message use the channelId/ts/dateDue shape
// (matches Slack's own message-reminder menu) rather than the free-text
// text/time form `/remind` uses — this links the reminder to the message
// itself instead of just embedding a permalink in reminder text.
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

// Slack's own query-completion suggestions (e.g. finishing a partial word,
// or a modifier like "from:") — distinct from searchHistory's locally-
// remembered past queries, which this is shown alongside rather than in
// place of.
export async function fetchSearchAutocomplete(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  const data = await apiGet(`/api/search/autocomplete?query=${encodeURIComponent(query)}`);
  if (!data.ok) return [];
  return data.suggestions ?? [];
}
