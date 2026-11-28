import { compareTs, parseTs, replyError } from "@slock/slack";
import { apiGet, mapVisibleMessages } from "@slock/slack/client";
import type { ChannelId, Message, RawMessage, Ts } from "@slock/types";

type RepliesReply = { has_more?: boolean; messages?: RawMessage[] };

export type ReplyPage = { edge?: Ts; hasMore: boolean; messages: Message[] };

export type EarlierReplyPage = {
  before: Ts;
  hasEarlier: boolean;
  messages: Message[];
  span: number;
};

type Range = { inclusive?: boolean; latest?: Ts; limit: number; oldest?: Ts };
const WINDOW_PAGE = 50;

export async function fetchRange(
  channelId: ChannelId,
  threadTs: Ts,
  range: Range,
): Promise<ReplyPage> {
  const query = new URLSearchParams({ limit: String(range.limit) });
  if (range.oldest) query.set("oldest", range.oldest);
  if (range.latest) query.set("latest", range.latest);
  if (range.inclusive) query.set("inclusive", "true");
  const data = await apiGet<RepliesReply>(
    `/api/channels/${channelId}/threads/${threadTs}/messages?${query}`,
  );
  if (!data.ok) throw replyError(data, "conversations.replies failed");
  const raws = (data.messages ?? []).filter(
    (raw) => raw.ts !== undefined && inRange(parseTs(raw.ts), range),
  );
  const last = raws.at(-1)?.ts;
  return {
    edge: last === undefined ? undefined : parseTs(last),
    hasMore: !!data.has_more,
    messages: mapVisibleMessages(raws),
  };
}

function inRange(ts: Ts, range: Range): boolean {
  if (range.oldest) {
    const order = compareTs(ts, range.oldest);
    if (range.inclusive ? order < 0 : order <= 0) return false;
  }
  if (range.latest) {
    const order = compareTs(ts, range.latest);
    if (range.inclusive ? order > 0 : order >= 0) return false;
  }
  return true;
}

export function fetchRepliesFrom(channelId: ChannelId, threadTs: Ts, from: Ts): Promise<ReplyPage> {
  return fetchRange(channelId, threadTs, { inclusive: true, limit: WINDOW_PAGE, oldest: from });
}
