import { apiGet, apiPost, broadcastRangeFromBlocks } from "@slock/slack";
import type {
  ActivityFeedPage,
  ActivityItem,
  FeedEntry,
  Message,
  RawActivityFeedEntry,
} from "@slock/types";
import { fetchCounts } from "../../slack/client/api";
import { ACTIVITY_FEED_TYPES_PARAM } from "../protocol/feedTypes";
import { mapFeedEntry } from "./feedEntry";

export { ACTIVITY_KIND_FEED_TYPES } from "./feedEntry";

export async function fetchActivityBadgeCounts(): Promise<Record<string, number>> {
  return (await fetchCounts()).notifications ?? {};
}

export async function markActivityRead(
  type: string,
  feedTs: string,
  key: string,
  linkedItemId?: string,
): Promise<void> {
  const data = await apiPost("/api/activity/read", { feedTs, key, linkedItemId, type });
  if (!data.ok) throw new Error(data.error ?? "activity.markRead failed");
}

export async function archiveActivityItem(type: string, key: string, ts: string): Promise<void> {
  const data = await apiPost("/api/activity/archive", { key, ts, type });
  if (!data.ok) throw new Error(data.error ?? "activity.archive failed");
}

export async function fetchActivityFeedEntries(
  limit = 50,
  cursor?: string,
  types: string = ACTIVITY_FEED_TYPES_PARAM,
  unreadOnly = false,
): Promise<ActivityFeedPage> {
  const query = new URLSearchParams({ limit: String(limit), types });
  if (cursor) query.set("cursor", cursor);
  if (unreadOnly) query.set("unreadOnly", "true");
  const data = await apiGet<{
    items?: RawActivityFeedEntry[];
    response_metadata?: { next_cursor?: string };
  }>(`/api/activity?${query}`);
  if (!data.ok) throw new Error(data.error ?? "activity.feed failed");
  const entries = (data.items ?? [])
    .map((raw) => mapFeedEntry(raw, parseFloat(raw.feed_ts ?? "") * 1000))
    .filter((entry): entry is FeedEntry => !!entry);
  return {
    entries,
    nextCursor: data.response_metadata?.next_cursor || undefined,
  };
}

export function resolveActivityEntry(
  entry: FeedEntry,
  batchedMessages?: Map<string, Message>,
): ActivityItem {
  const msg = batchedMessages?.get(`${entry.channelId}:${entry.ts}`);
  const isReaction = entry.kind === "reaction";
  const broadcastRange = entry.broadcastRange ?? broadcastRangeFromBlocks(msg?.blocks);

  const userId = isReaction ? entry.userId || msg?.userId || "" : (msg?.userId ?? entry.userId);
  return {
    ...entry,
    broadcastRange,
    blocks: msg?.blocks ?? entry.blocks,
    botIcon: !isReaction && msg ? msg.botIcon : entry.botIcon,
    botId: !isReaction && msg ? msg.botId : entry.botId,
    botName: !isReaction && msg ? msg.botName : entry.botName,
    files: msg?.files ?? entry.files,
    kind: entry.kind === "channel_all" && broadcastRange ? "channel_mention" : entry.kind,
    text: msg?.text || entry.text || "",

    threadTs:
      entry.kind === "reaction"
        ? (msg?.threadTs ?? ((msg?.replyCount ?? 0) > 0 ? msg?.ts : undefined) ?? entry.threadTs)
        : entry.threadTs,
    userId,
  };
}
