import { broadcastRangeFromBlocks } from "../../blocks";
import {
  type ACTIVITY_FEED_TYPES,
  ACTIVITY_FEED_TYPES_PARAM,
  type ActivityItem,
} from "../../contentTypes";
import type { Message } from "../../types";
import { HIDE_SUBTYPES, mapMessage } from "../mappers";
import { apiGet, apiPost } from "../server";

const ACTIVITY_TYPE_KINDS = {
  at_channel: "channel_mention",
  at_everyone: "channel_mention",
  at_user: "mention",
  at_user_group: "usergroup_mention",
  bot_dm_bundle: "dm",
  channel: "channel_all",
  dm: "dm",
  external_channel_invite: "other",
  external_dm_invite: "other",
  internal_channel_invite: "other",
  keyword: "keyword",
  list_approval_request: "other",
  list_approval_reviewed: "other",
  list_record_assigned: "other",
  list_record_edited: "other",
  list_todo_notification: "other",
  list_user_mentioned: "other",
  message_reaction: "reaction",
  quietly_added_to_channel: "other",
  saved_reminder: "other",
  thread_v2: "thread_reply",
  unjoined_channel_mention: "channel_mention",
} as const satisfies Record<(typeof ACTIVITY_FEED_TYPES)[number], ActivityItem["kind"]>;

function activityKindFor(type: string): ActivityItem["kind"] {
  return ACTIVITY_TYPE_KINDS[type as keyof typeof ACTIVITY_TYPE_KINDS] ?? "other";
}

export const ACTIVITY_KIND_FEED_TYPES: Record<ActivityItem["kind"], string[]> = Object.entries(
  ACTIVITY_TYPE_KINDS,
).reduce<Record<ActivityItem["kind"], string[]>>(
  (types, [type, kind]) => {
    types[kind].push(type);
    return types;
  },
  {
    channel_all: [],
    channel_mention: [],
    dm: [],
    keyword: [],
    mention: [],
    other: [],
    reaction: [],
    thread_reply: [],
    usergroup_mention: [],
  },
);

export type FeedEntry = Omit<ActivityItem, "text"> & { text?: string };

function rawMessageText(message: any): string | undefined {
  return typeof message?.text === "string" ? message.text : undefined;
}

function rawMessageUserId(message: any): string | undefined {
  return message?.user ?? message?.author_user_id ?? message?.bot_id ?? undefined;
}

function rawMessageAuthor(
  message: any,
  userId: string,
): Pick<ActivityItem, "botIcon" | "botId" | "botName"> {
  if (typeof message?.ts !== "string" || rawMessageUserId(message) !== userId) return {};
  const { botIcon, botId, botName } = mapMessage(message);
  return { botIcon, botId, botName };
}

function rawActivityUserId(item: any): string | undefined {
  return (
    item?.latest_reply_actor_user_id ??
    item?.actor_user_id ??
    item?.author_user_id ??
    item?.latest_user_id ??
    item?.user ??
    item?.user_id ??
    undefined
  );
}

const EXACT_CHANNEL_FEED_KEY_RE = /^[CG][A-Z0-9]{8,}$/;
const EMBEDDED_CHANNEL_FEED_KEY_RE = /(?:^|[^A-Z0-9])([CG][A-Z0-9]{8,})(?=$|[^A-Z0-9])/;

function channelIdFromFeedKey(key: unknown): string | undefined {
  if (typeof key !== "string") return;
  if (EXACT_CHANNEL_FEED_KEY_RE.test(key)) return key;
  return key.match(EMBEDDED_CHANNEL_FEED_KEY_RE)?.[1];
}

function mapFeedEntry(raw: any, time: number): FeedEntry | undefined {
  const type = raw.item?.type;
  if (typeof type !== "string") return;
  const kind = activityKindFor(type);
  if (raw.item.type === "message_reaction") {
    const { message, reaction } = raw.item;
    if (message && reaction)
      return {
        activityType: type,
        channelId: message.channel,
        feedTs: String(raw.feed_ts),
        id: raw.key,
        kind,
        reactionName: reaction.name,
        time,
        ts: message.ts,
        userId: reaction.user,
      };
  }
  if (raw.item.type === "thread_v2") {
    const thread = raw.item.bundle_info?.payload?.thread_entry;
    if (thread) {
      const latestMessage =
        thread.latest_message ?? thread.latest_msg ?? thread.message ?? raw.item.message;
      const userId =
        thread.latest_reply_actor_user_id ??
        thread.latest_user_id ??
        thread.latest_reply_user_id ??
        thread.user_id ??
        rawMessageUserId(latestMessage) ??
        rawActivityUserId(raw.item) ??
        "";
      return {
        activityType: type,
        ...rawMessageAuthor(latestMessage, userId),
        channelId: thread.channel_id,
        feedTs: String(raw.feed_ts),
        id: raw.key,
        kind,
        text: rawMessageText(latestMessage) ?? raw.item.activity_text,
        threadTs: thread.thread_ts,
        time,
        ts: thread.latest_ts,
        unreadCount: thread.unread_msg_count,
        userId,
      };
    }
  }
  const payload = raw.item.bundle_info?.payload;
  const channelEntry = payload?.channel_entry;
  const quietlyAdded = raw.item.quietly_added_to_channel_payload;
  const message =
    raw.item.message ??
    payload?.message ??
    payload?.latest_message ??
    payload?.dm_entry?.latest_message ??
    channelEntry?.latest_message ??
    channelEntry?.message ??
    channelEntry;
  const isSparseType =
    type === "channel" ||
    type === "internal_channel_invite" ||
    type === "external_channel_invite" ||
    type === "external_dm_invite" ||
    type === "quietly_added_to_channel";
  const sparseChannelId = isSparseType ? channelIdFromFeedKey(raw.key) : undefined;
  const channelId =
    message?.channel ??
    channelEntry?.channel_id ??
    quietlyAdded?.channel_id ??
    raw.item.channel_id ??
    raw.item.channel ??
    raw.item.invite ??
    sparseChannelId;
  const ts =
    message?.ts ??
    channelEntry?.latest_ts ??
    raw.item.message_ts ??
    raw.item.ts ??
    (quietlyAdded?.channel_id ? raw.feed_ts : undefined) ??
    (sparseChannelId ? raw.feed_ts : undefined);
  if (!(channelId && ts)) {
    const text = rawMessageText(message) ?? raw.item.activity_text;
    const userId = rawMessageUserId(message) ?? rawActivityUserId(raw.item) ?? "";
    return {
      activityType: type,
      ...rawMessageAuthor(message, userId),
      channelId: "",
      feedTs: String(raw.feed_ts),
      id: String(raw.key ?? `${type}:${raw.feed_ts}`),
      kind,
      text,
      time,
      ts: String(raw.item?.ts ?? raw.feed_ts ?? raw.key),
      userId,
    };
  }
  const userId =
    rawMessageUserId(message) ??
    channelEntry?.latest_user_id ??
    channelEntry?.user_id ??
    raw.item.latest_user_id ??
    rawActivityUserId(raw.item) ??
    quietlyAdded?.inviter_user_id ??
    "";
  const text = rawMessageText(message) ?? raw.item.activity_text;
  return {
    activityType: type,
    ...rawMessageAuthor(message, userId),
    broadcastRange:
      raw.item.type === "at_everyone"
        ? "everyone"
        : raw.item.type === "at_channel"
          ? "channel"
          : undefined,
    channelId,
    feedTs: String(raw.feed_ts),
    id: raw.key,
    kind,
    threadTs: message?.thread_ts && message.thread_ts !== ts ? message.thread_ts : undefined,
    time,
    ts,
    text,
    unread: typeof raw.is_unread === "boolean" ? raw.is_unread : undefined,

    userId,
  };
}

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
