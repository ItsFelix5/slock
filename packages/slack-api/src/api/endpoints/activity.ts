// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
import type { ActivityItem, Message } from "../../types";
import { HIDE_SUBTYPES, mapMessage } from "../mappers";
import { callSlack } from "../relay";

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

type FeedEntry = Omit<ActivityItem, "text">;

// Each feed entry only carries ids (channel/ts/reactor), never the message
// body — fetchActivityMessages below resolves those ids with one batched
// messages.list request grouped by channel.
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
    return {
      channelId: thread.channel_id,
      id: raw.key,
      kind,
      threadTs: thread.thread_ts,
      time,
      ts: thread.latest_ts,
      unreadCount: thread.unread_msg_count,
      userId: "",
    };
  }
  const { message } = raw.item;
  if (!message) return;
  return {
    broadcastRange:
      raw.item.type === "at_everyone"
        ? "everyone"
        : raw.item.type === "at_channel"
          ? "channel"
          : undefined,
    channelId: message.channel,
    id: raw.key,
    kind,
    threadTs: message.thread_ts && message.thread_ts !== message.ts ? message.thread_ts : undefined,
    time,
    ts: message.ts,
    userId: message.author_user_id ?? "",
  };
}

// Slack's own client-side Activity tab, undocumented and used here because
// there's no public endpoint that returns historical dm/thread/reaction/
// broadcast activity — search.messages only ever finds literal @mentions.
// Only carries ids (channel/ts/reactor) — resolveActivityEntry below fetches
// each entry's message body separately, kept split from this call so callers
export async function fetchActivityFeedEntries(limit = 50): Promise<FeedEntry[]> {
  const data = await callSlack("activity.feed", {
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
  });
  if (!data.ok) return [];
  return ((data.items ?? []) as any[])
    .map((raw) => mapFeedEntry(raw, parseFloat(raw.feed_ts) * 1000))
    .filter((entry): entry is FeedEntry => !!entry);
}

type MessageIdGroup = { channel: string; timestamps: string[] };

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
// can appear with several timestamps.
export async function fetchActivityMessages(entries: FeedEntry[]): Promise<Map<string, Message>> {
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
  const results = await Promise.all(
    chunks.map((messageIds) =>
      callSlack("messages.list", { message_ids: JSON.stringify(messageIds) }),
    ),
  );
  for (const data of results) {
    if (!data.ok) {
      console.error("messages.list failed while resolving activity", data);
      continue;
    }
    for (const [channelId, entry] of Object.entries(data.messages_data ?? {}) as [string, any][]) {
      for (const raw of rawMessagesFromMessagesListEntry(entry)) {
        if (raw?.ts && !HIDE_SUBTYPES.has(raw.subtype))
          byKey.set(`${channelId}:${raw.ts}`, mapMessage(raw));
      }
    }
  }
  return byKey;
}

export function resolveActivityEntry(
  entry: FeedEntry,
  batchedMessages?: Map<string, Message>,
): ActivityItem {
  const msg = batchedMessages?.get(`${entry.channelId}:${entry.ts}`);
  return {
    ...entry,
    text: msg?.text ?? "",
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
