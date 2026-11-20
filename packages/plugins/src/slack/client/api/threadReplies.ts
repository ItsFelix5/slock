import { apiGet, mapVisibleMessages } from "@slock/slack";
import type { ChannelId, Message, RawMessage, Ts } from "@slock/types";

type RepliesReply = { has_more?: boolean; messages?: RawMessage[] };

export type ReplyPage = { edge?: string; hasMore: boolean; messages: Message[] };

export type EarlierReplyPage = {
  before: string;
  hasEarlier: boolean;
  messages: Message[];
  span: number;
};

type Range = { inclusive?: boolean; latest?: string; limit: number; oldest?: string };

const FORWARD_PAGE = 100;
const WINDOW_PAGE = 50;
const EARLIER_PAGE = 40;
const FIRST_SPAN_SECONDS = 3600;
const WIDEN_FACTOR = 8;
const MIN_SPAN_SECONDS = 1e-6;

async function fetchRange(channelId: ChannelId, threadTs: Ts, range: Range): Promise<ReplyPage> {
  const query = new URLSearchParams({ limit: String(range.limit) });
  if (range.oldest) query.set("oldest", range.oldest);
  if (range.latest) query.set("latest", range.latest);
  if (range.inclusive) query.set("inclusive", "true");
  const data = await apiGet<RepliesReply>(
    `/api/channels/${channelId}/threads/${threadTs}/messages?${query}`,
  );
  if (!data.ok) throw new Error(data.error ?? "conversations.replies failed");
  const raws = (data.messages ?? []).filter(
    (raw) => raw.ts !== undefined && inRange(raw.ts, range),
  );
  return {
    edge: raws.at(-1)?.ts,
    hasMore: !!data.has_more,
    messages: mapVisibleMessages(raws),
  };
}

function inRange(ts: string, range: Range): boolean {
  const value = Number(ts);
  if (range.oldest) {
    const oldest = Number(range.oldest);
    if (range.inclusive ? value < oldest : value <= oldest) return false;
  }
  if (range.latest) {
    const latest = Number(range.latest);
    if (range.inclusive ? value > latest : value >= latest) return false;
  }
  return true;
}

export function fetchReplies(
  channelId: ChannelId,
  threadTs: Ts,
  after?: string,
): Promise<ReplyPage> {
  return fetchRange(channelId, threadTs, { limit: FORWARD_PAGE, oldest: after });
}

export function fetchRepliesFrom(
  channelId: ChannelId,
  threadTs: Ts,
  from: string,
): Promise<ReplyPage> {
  return fetchRange(channelId, threadTs, { inclusive: true, limit: WINDOW_PAGE, oldest: from });
}

export async function fetchThreadRoot(channelId: ChannelId, threadTs: Ts) {
  const page = await fetchRange(channelId, threadTs, {
    inclusive: true,
    latest: threadTs,
    limit: 1,
  });
  return page.messages.find((m) => m.ts === threadTs);
}

export async function fetchRepliesBefore(
  channelId: ChannelId,
  threadTs: Ts,
  before: string,
  spanHint = FIRST_SPAN_SECONDS,
): Promise<EarlierReplyPage> {
  const floor = Number(threadTs);
  const ceiling = Number(before);
  let narrow = ceiling;
  let wide: number | undefined;
  let span = spanHint;
  let best: Message[] = [];
  while (true) {
    const candidate = wide === undefined ? Math.max(ceiling - span, floor) : (narrow + wide) / 2;
    span *= WIDEN_FACTOR;
    const page = await fetchRange(channelId, threadTs, {
      latest: before,
      limit: EARLIER_PAGE,
      oldest: candidate.toFixed(6),
    });
    if (page.hasMore) {
      wide = candidate;
    } else {
      narrow = candidate;
      best = page.messages;
    }
    const reachedRoot = narrow <= floor;
    const full = best.length >= EARLIER_PAGE / 2;
    const exhausted = wide !== undefined && narrow - wide <= MIN_SPAN_SECONDS;
    if (reachedRoot || exhausted || full) {
      return {
        before: narrow.toFixed(6),
        hasEarlier: !reachedRoot,
        messages: best,
        span: Math.max(ceiling - narrow, MIN_SPAN_SECONDS),
      };
    }
  }
}
