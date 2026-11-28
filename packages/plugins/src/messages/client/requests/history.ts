import { service } from "@slock/core/solid";
import { fetchHistoryPage } from "@slock/plugins/slack/client/api/messageHistory";
import { FIRST_HISTORY_PAGE_SIZE, HISTORY_PAGE_SIZE } from "@slock/slack";

import type { ChannelId, HistoryPage } from "@slock/types";

export async function fetchHistory(channelId: ChannelId, cursor?: string): Promise<HistoryPage> {
  if (!cursor) {
    const page = await fetchHistoryPage(
      channelId,
      new URLSearchParams({ limit: FIRST_HISTORY_PAGE_SIZE }),
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

export async function fetchHistoryNewer(
  channelId: ChannelId,
  oldest: string,
  spanHint = NEWER_FIRST_SPAN_SECONDS,
): Promise<HistoryPage> {
  let start = parseFloat(oldest);
  let span = spanHint;
  for (;;) {
    const window = await fetchNewerWindow(channelId, start, span);
    if (window.page.hasMore && span > NEWER_MIN_SPAN_SECONDS) {
      span = narrowedSpan(window, span);
      continue;
    }
    if (window.reachesPresent || window.page.messages.length > 0) return newerPage(window);
    start = window.end;
    span *= NEWER_WIDEN_FACTOR;
  }
}

const NEWER_FIRST_SPAN_SECONDS = 3600;

const NEWER_WIDEN_FACTOR = 8;

async function fetchNewerWindow(
  channelId: ChannelId,
  start: number,
  span: number,
): Promise<NewerWindow> {
  const end = start + span;
  const reachesPresent = end >= env.now() / 1000;
  const query = new URLSearchParams({
    inclusive: "false",
    latest: end.toFixed(6),
    limit: String(NEWER_PAGE_SIZE),
    oldest: start.toFixed(6),
  });
  return { end, page: await fetchHistoryPage(channelId, query), reachesPresent };
}

function narrowedSpan(window: NewerWindow, span: number): number {
  const first = window.page.messages[0]?.ts;
  const last = window.page.messages.at(-1)?.ts;
  const covered = first && last ? Number(last) - Number(first) : span;
  return Math.max(NEWER_MIN_SPAN_SECONDS, Math.min(span / 2, covered / 2));
}

function newerPage({ end, page, reachesPresent }: NewerWindow): HistoryPage {
  if (reachesPresent) return { hasMore: false, messages: page.messages };
  return { hasMore: true, messages: page.messages, nextCursor: end.toFixed(6) };
}

const env = service("env");

const NEWER_PAGE_SIZE = 60;

const NEWER_MIN_SPAN_SECONDS = 1;

type NewerWindow = { end: number; page: HistoryPage; reachesPresent: boolean };
