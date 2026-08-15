import { broadcastRangeFromBlocks } from "../../blocks";
import { ACTIVITY_FEED_TYPES_PARAM, type ActivityItem } from "../../contentTypes";
import type { Message } from "../../types";
import { HIDE_SUBTYPES, mapMessage } from "../mappers";
import { apiGet, apiPost } from "../server";
import { type FeedEntry, mapFeedEntry } from "./activityFeedEntry";

export type { FeedEntry } from "./activityFeedEntry";
export { ACTIVITY_KIND_FEED_TYPES } from "./activityFeedEntry";

export interface ActivityFeedPage {
  entries: FeedEntry[];
  nextCursor?: string;
}

export async function fetchActivityBadgeCounts(): Promise<Record<string, number>> {
  const data = await apiGet("/api/activity/counts");
  if (!data.ok) throw new Error(data.error ?? "client.counts failed");
  return data.activityCounts ?? {};
}

export async function markActivityRead(type: string, feedTs: string, key: string): Promise<void> {
  const data = await apiPost("/api/activity/read", { feedTs, key, type });
  if (!data.ok) throw new Error(data.error ?? "activity.markRead failed");
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
  const data = await apiGet(`/api/activity?${query}`);
  if (!data.ok) throw new Error(data.error ?? "activity.feed failed");
  const entries = ((data.items ?? []) as any[])
    .map((raw) => mapFeedEntry(raw, parseFloat(raw.feed_ts) * 1000))
    .filter((entry): entry is FeedEntry => !!entry);
  return {
    entries,
    nextCursor: data.response_metadata?.next_cursor || undefined,
  };
}

type MessageIdGroup = { channel: string; timestamps: string[] };
type MessageRef = { channelId: string; ts: string };

const MESSAGES_LIST_BATCH_SIZE = 25;

function chunkMessageIds(messageGroups: MessageIdGroup[]): MessageIdGroup[][] {
  const chunks: MessageIdGroup[][] = [];
  let currentChunk: MessageIdGroup[] = [];
  let currentSize = 0;
  const flushChunk = () => {
    if (currentChunk.length === 0) return;
    chunks.push(currentChunk);
    currentChunk = [];
    currentSize = 0;
  };
  for (const group of messageGroups) {
    for (let i = 0; i < group.timestamps.length; i += MESSAGES_LIST_BATCH_SIZE) {
      const part = {
        channel: group.channel,
        timestamps: group.timestamps.slice(i, i + MESSAGES_LIST_BATCH_SIZE),
      };
      if (currentSize > 0 && currentSize + part.timestamps.length > MESSAGES_LIST_BATCH_SIZE)
        flushChunk();
      currentChunk.push(part);
      currentSize += part.timestamps.length;
    }
  }
  flushChunk();
  return chunks;
}

function rawMessagesFromMessagesListEntry(entry: any): any[] {
  const messages = entry?.messages ?? entry;
  if (!messages) return [];
  if (Array.isArray(messages)) return messages;
  if (messages.ts) return [messages];
  if (typeof messages === "object") return Object.values(messages);
  return [];
}

export async function fetchMessagesByIds(
  entries: MessageRef[],
  onBatch?: (batch: Map<string, Message>) => void,
): Promise<Map<string, Message>> {
  const timestampsByChannel = new Map<string, Set<string>>();
  for (const entry of entries) {
    const set = timestampsByChannel.get(entry.channelId) ?? new Set<string>();
    set.add(entry.ts);
    timestampsByChannel.set(entry.channelId, set);
  }
  const byKey = new Map<string, Message>();
  if (timestampsByChannel.size === 0) return byKey;
  const messageGroups = [...timestampsByChannel].map(([channel, timestamps]) => ({
    channel,
    timestamps: [...timestamps],
  }));
  const chunks = chunkMessageIds(messageGroups);
  const resolveChunk = async (messageIds: MessageIdGroup[]): Promise<void> => {
    const data = await apiPost("/api/messages/lookup", { messageIds });
    if (!data.ok) {
      if (data.error === "too_many_channels" && messageIds.length > 1) {
        const middle = Math.ceil(messageIds.length / 2);
        await resolveChunk(messageIds.slice(0, middle));
        await resolveChunk(messageIds.slice(middle));
        return;
      }
      throw new Error(data.error ?? "messages.list failed while resolving activity");
    }
    const batch = new Map<string, Message>();
    for (const [channelId, entry] of Object.entries(data.messages ?? {}) as [string, any][]) {
      for (const raw of rawMessagesFromMessagesListEntry(entry)) {
        if (raw?.ts && !HIDE_SUBTYPES.has(raw.subtype)) {
          const key = `${channelId}:${raw.ts}`;
          const message = mapMessage(raw);
          batch.set(key, message);
          byKey.set(key, message);
        }
      }
    }
    onBatch?.(batch);
  };
  const results = await Promise.allSettled(chunks.map(resolveChunk));
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  return byKey;
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
    botIcon: !isReaction && msg ? msg.botIcon : entry.botIcon,
    botId: !isReaction && msg ? msg.botId : entry.botId,
    botName: !isReaction && msg ? msg.botName : entry.botName,
    kind: entry.kind === "channel_all" && broadcastRange ? "channel_mention" : entry.kind,
    text: msg?.text ?? entry.text ?? "",

    threadTs:
      entry.kind === "reaction"
        ? (msg?.threadTs ?? ((msg?.replyCount ?? 0) > 0 ? msg?.ts : undefined))
        : entry.threadTs,
    userId,
  };
}
