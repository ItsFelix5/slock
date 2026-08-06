// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
// biome-ignore-all lint/style/noExcessiveLinesPerFile: One cohesive module for the undocumented activity feed endpoint and its entry mapping.
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
  external_channel_invite: "channel_invite",
  external_dm_invite: "channel_invite",
  internal_channel_invite: "channel_invite",
  keyword: "keyword",
  list_approval_request: "list",
  list_approval_reviewed: "list",
  list_record_assigned: "list",
  list_record_edited: "list",
  list_todo_notification: "list",
  list_user_mentioned: "list",
  message_reaction: "reaction",
  quietly_added_to_channel: "channel_invite",
  saved_reminder: "reminder",
  thread_v2: "thread_reply",
  unjoined_channel_mention: "channel_mention",
} as const satisfies Record<(typeof ACTIVITY_FEED_TYPES)[number], ActivityItem["kind"]>;

function activityKindFor(type: string): ActivityItem["kind"] {
  return ACTIVITY_TYPE_KINDS[type as keyof typeof ACTIVITY_TYPE_KINDS] ?? "list";
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
    channel_invite: [],
    channel_mention: [],
    dm: [],
    keyword: [],
    list: [],
    mention: [],
    reaction: [],
    reminder: [],
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

const EXACT_CHANNEL_FEED_KEY_RE = /^[CG][A-Z0-9]{8,}$/;
const EMBEDDED_CHANNEL_FEED_KEY_RE = /(?:^|[^A-Z0-9])([CG][A-Z0-9]{8,})(?=$|[^A-Z0-9])/;

function channelIdFromFeedKey(key: unknown): string | undefined {
  if (typeof key !== "string") return;
  if (EXACT_CHANNEL_FEED_KEY_RE.test(key)) return key;
  return key.match(EMBEDDED_CHANNEL_FEED_KEY_RE)?.[1];
}

// Feed entries carry a message reference in several shapes. The body is not
// guaranteed, so fetchMessagesByIds below resolves missing bodies in one
// batched messages.list request grouped by channel.
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
      return {
        activityType: type,
        channelId: thread.channel_id,
        feedTs: String(raw.feed_ts),
        id: raw.key,
        kind,
        text: rawMessageText(latestMessage),
        threadTs: thread.thread_ts,
        time,
        ts: thread.latest_ts,
        unreadCount: thread.unread_msg_count,
        userId:
          thread.latest_reply_actor_user_id ??
          thread.latest_user_id ??
          thread.latest_reply_user_id ??
          thread.user_id ??
          rawMessageUserId(latestMessage) ??
          "",
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
  const isSparseType = raw.item.type === "channel" || kind === "channel_invite";
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
    const userId = rawMessageUserId(message) ?? raw.item?.user_id ?? "";
    return {
      activityType: type,
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
  return {
    activityType: type,
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
    text: rawMessageText(message) ?? raw.item.activity_text,
    unread: typeof raw.is_unread === "boolean" ? raw.is_unread : undefined,
    // Message-backed activity uses `user` for the actor in current payloads;
    // some older shapes expose the same person as `author_user_id` instead.
    // In particular, ordinary `channel` entries generally only carry `user`.
    userId:
      rawMessageUserId(message) ??
      channelEntry?.latest_user_id ??
      channelEntry?.user_id ??
      raw.item.latest_user_id ??
      raw.item.user_id ??
      quietlyAdded?.inviter_user_id ??
      "",
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

// Slack's own client-side Activity tab, undocumented and used here because
// there's no public endpoint that returns historical dm/thread/reaction/
// broadcast activity — search.messages only ever finds literal @mentions.
// Only carries ids (channel/ts/reactor) — resolveActivityEntry below fetches
// each entry's message body separately, kept split from this call so callers
// Paginates like Slack's other list endpoints: pass a prior page's
// `nextCursor` back in as `cursor` to walk further into the history.
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
  return { entries, nextCursor: data.response_metadata?.next_cursor || undefined };
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

// Slack's own Activity tab resolves every entry's message body with
// messages.list: one form field named `message_ids` whose value is a JSON
// array like [{channel, timestamps}]. Keyed by `channel:ts` since a channel
// can appear with several timestamps. `onBatch` fires per resolved chunk with
// just that chunk's messages, so callers can render each batch the moment it
// lands instead of blocking on the slowest one.
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
  return {
    ...entry,
    text: msg?.text ?? entry.text ?? "",
    // message_reaction entries never carry thread_ts from the feed itself
    // (unlike at_user/dm/keyword, which do) — the fetched message is the
    // only source for it, needed so a reply you post in that thread later
    // is recognized as covering this activity (see engagementCoversItem).
    threadTs:
      entry.kind === "reaction"
        ? (msg?.threadTs ?? ((msg?.replyCount ?? 0) > 0 ? msg?.ts : undefined))
        : entry.threadTs,
    userId: entry.userId || msg?.userId || "",
  };
}
