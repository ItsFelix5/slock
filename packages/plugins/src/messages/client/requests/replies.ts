import type { EarlierReplyPage, ReplyPage } from "@slock/plugins/slack/client/api/threadReplies";
import { fetchRange } from "@slock/plugins/slack/client/api/threadReplies";
import { parseTs } from "@slock/slack";
import type { ChannelId, Message, Ts } from "@slock/types";

export function fetchReplies(channelId: ChannelId, threadTs: Ts, after?: Ts): Promise<ReplyPage> {
  return fetchRange(channelId, threadTs, { limit: FORWARD_PAGE, oldest: after });
}

export async function fetchRepliesBefore(
  channelId: ChannelId,
  threadTs: Ts,
  before: Ts,
  spanHint = FIRST_SPAN_SECONDS,
): Promise<EarlierReplyPage> {
  const floor = Number(threadTs);
  const ceiling = Number(before);
  const everything = await fetchRange(channelId, threadTs, {
    latest: before,
    limit: FULL_EARLIER_PAGE,
    oldest: threadTs,
  });
  if (!everything.hasMore)
    return {
      before: threadTs,
      hasEarlier: false,
      messages: everything.messages,
      span: Math.max(ceiling - floor, MIN_SPAN_SECONDS),
    };
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
      oldest: parseTs(candidate.toFixed(6)),
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
        before: parseTs(narrow.toFixed(6)),
        hasEarlier: !reachedRoot,
        messages: best,
        span: Math.max(ceiling - narrow, MIN_SPAN_SECONDS),
      };
    }
  }
}

const FORWARD_PAGE = 100;

const EARLIER_PAGE = 40;

const FULL_EARLIER_PAGE = 100;

const FIRST_SPAN_SECONDS = 3600;

const WIDEN_FACTOR = 8;

const MIN_SPAN_SECONDS = 1e-6;
