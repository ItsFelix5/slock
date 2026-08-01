// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
// biome-ignore-all lint/style/noExcessiveLinesPerFile: One cohesive module for the undocumented activity feed endpoint and its entry mapping.
import type { ActivityItem } from "../../contentTypes";
import type { Message } from "../../types";
import { HIDE_SUBTYPES, mapMessage } from "../mappers";
import { callSlack } from "../server";

// Feed types worth surfacing, mapped to our ActivityItem kinds below. Slack
// also emits app/workflow feed types (list_record_assigned, saved_reminder,
// external_channel_invite, ...) with no equivalent in our model — left out of
// the request entirely rather than fetched and silently dropped.
const ACTIVITY_FEED_TYPES = [
  "at_user",
  "at_user_group",
  "at_channel",
  "at_everyone",
  "keyword",
  "thread_v2",
  "message_reaction",
  "dm",
  "channel",
].join(",");

function activityKindFor(type: string): ActivityItem["kind"] | undefined {
  switch (type) {
    case "at_user":
      return "mention";
    case "dm":
      return "dm";
    case "keyword":
      return "keyword";
    case "thread_v2":
      return "thread_reply";
    case "at_channel":
    case "at_everyone":
      return "channel_mention";
    case "at_user_group":
      return "usergroup_mention";
    case "channel":
      return "channel_all";
    case "message_reaction":
      return "reaction";
    default:
      return;
  }
}

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
  const kind = activityKindFor(raw.item?.type);
  if (!kind) return;
  if (raw.item.type === "message_reaction") {
    const { message, reaction } = raw.item;
    if (!(message && reaction)) return;
    return {
      channelId: message.channel,
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
    if (!thread) return;
    const latestMessage =
      thread.latest_message ?? thread.latest_msg ?? thread.message ?? raw.item.message;
    return {
      channelId: thread.channel_id,
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
  const payload = raw.item.bundle_info?.payload;
  const channelEntry = payload?.channel_entry;
  const message =
    raw.item.message ??
    payload?.message ??
    payload?.latest_message ??
    payload?.dm_entry?.latest_message ??
    channelEntry?.latest_message ??
    channelEntry?.message ??
    channelEntry;
  const sparseChannelId = raw.item.type === "channel" ? channelIdFromFeedKey(raw.key) : undefined;
  const channelId =
    message?.channel ??
    channelEntry?.channel_id ??
    raw.item.channel_id ??
    raw.item.channel ??
    sparseChannelId;
  const ts =
    message?.ts ??
    channelEntry?.latest_ts ??
    raw.item.message_ts ??
    raw.item.ts ??
    (sparseChannelId ? raw.feed_ts : undefined);
  if (!(channelId && ts)) return;
  return {
    broadcastRange:
      raw.item.type === "at_everyone"
        ? "everyone"
        : raw.item.type === "at_channel"
          ? "channel"
          : undefined,
    channelId,
    id: raw.key,
    kind,
    threadTs: message?.thread_ts && message.thread_ts !== ts ? message.thread_ts : undefined,
    time,
    ts,
    text: rawMessageText(message),
    // Message-backed activity uses `user` for the actor in current payloads;
    // some older shapes expose the same person as `author_user_id` instead.
    // In particular, ordinary `channel` entries generally only carry `user`.
    userId:
      rawMessageUserId(message) ??
      channelEntry?.latest_user_id ??
      channelEntry?.user_id ??
      raw.item.latest_user_id ??
      raw.item.user_id ??
      "",
  };
}

export interface ActivityFeedPage {
  entries: FeedEntry[];
  nextCursor?: string;
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
): Promise<ActivityFeedPage> {
  const params: Record<string, string> = {
    archive_only: "false",
    automations_only: "false",
    exclude_automations: "false",
    is_activity_inbox: "true",
    limit: String(limit),
    mode: "chrono_v1",
    only_salesforce_channels: "false",
    priority_only: "false",
    types: ACTIVITY_FEED_TYPES,
    unread_only: "false",
  };
  if (cursor) params.cursor = cursor;
  const data = await callSlack("activity.feed", params);
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
  const results = await Promise.allSettled(
    chunks.map(async (messageIds) => {
      const data = await callSlack("messages.list", { message_ids: JSON.stringify(messageIds) });
      if (!data.ok) {
        throw new Error(data.error ?? "messages.list failed while resolving activity");
      }
      // Slack's response nests each channel's resolved messages under `messages`
      // (an empty `messages_data` object comes back alongside it, unused).
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
    }),
  );
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
