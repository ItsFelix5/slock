import { defined } from "@slock/core";
import { apiGet, HISTORY_PAGE_SIZE, mapVisibleMessages } from "@slock/slack";
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
    const page = await fetchHistoryPage(
      channelId,
      new URLSearchParams({ limit: HISTORY_PAGE_SIZE }),
    );
    const oldest = page.messages[0]?.ts;
    return { ...page, nextCursor: page.hasMore && oldest ? `before:${oldest}` : undefined };
  }

  const query = new URLSearchParams({ limit: HISTORY_PAGE_SIZE });
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

const NEWER_PAGE_SIZE = 50;
const NEWER_SPANS_SECONDS = [300, 3600, 43200, 518400];
const NEWER_MIN_SPAN_SECONDS = 1;

function newerSpans(start: number): number[] {
  const now = Date.now() / 1000;
  const reaching = NEWER_SPANS_SECONDS.findIndex((span) => start + span >= now);
  return reaching < 0 ? NEWER_SPANS_SECONDS : NEWER_SPANS_SECONDS.slice(0, reaching + 1);
}

type NewerWindow = { end: number; page: HistoryPage; reachesPresent: boolean };

async function fetchNewerWindow(
  channelId: string,
  start: number,
  span: number,
): Promise<NewerWindow> {
  const end = start + span;
  const reachesPresent = end >= Date.now() / 1000;
  const query = new URLSearchParams({
    inclusive: "false",
    limit: String(NEWER_PAGE_SIZE),
    oldest: start.toFixed(6),
  });
  if (!reachesPresent) query.set("latest", end.toFixed(6));
  return { end, page: await fetchHistoryPage(channelId, query), reachesPresent };
}

function newerPage({ end, page, reachesPresent }: NewerWindow): HistoryPage {
  if (reachesPresent) return { hasMore: false, messages: page.messages };
  return { hasMore: true, messages: page.messages, nextCursor: end.toFixed(6) };
}

async function bisectNewer(channelId: string, from: number, firstSpan: number) {
  let start = from;
  let span = firstSpan;
  for (;;) {
    const window = await fetchNewerWindow(channelId, start, span);
    if (window.page.hasMore && span > NEWER_MIN_SPAN_SECONDS) {
      span /= 2;
      continue;
    }
    if (window.reachesPresent || window.page.messages.length > 0) return newerPage(window);
    start = window.end;
    span *= 2;
  }
}

export async function fetchHistoryNewer(channelId: string, oldest: string): Promise<HistoryPage> {
  let start = parseFloat(oldest);
  for (;;) {
    const windows = await Promise.all(
      newerSpans(start).map((span) => fetchNewerWindow(channelId, start, span)),
    );
    const fitting = windows.findLast(
      (w) => !w.page.hasMore && (w.reachesPresent || w.page.messages.length > 0),
    );
    if (fitting) return newerPage(fitting);
    const overflow = windows.findIndex((w) => w.page.hasMore);
    if (overflow >= 0)
      return bisectNewer(channelId, start, defined(NEWER_SPANS_SECONDS[overflow]) / 2);
    start = defined(windows.at(-1)).end;
  }
}
