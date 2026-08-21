import type { ACTIVITY_FEED_TYPES, ActivityItem, FeedEntry } from "@slock/types";
import { mapMessage } from "@slock/types";

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

function rawMessageText(message: any): string | undefined {
  return typeof message?.text === "string" ? message.text : undefined;
}

function rawMessageUserId(message: any): string | undefined {
  return message?.user ?? message?.author_user_id ?? message?.bot_id ?? undefined;
}

function rawMessageAuthor(
  message: any,
  userId: string,
): Pick<ActivityItem, "botIcon" | "botId" | "botName" | "sourceUserId"> {
  if (typeof message?.ts !== "string" || rawMessageUserId(message) !== userId) return {};
  const { botIcon, botId, botName, sourceUserId } = mapMessage(message);
  return { botIcon, botId, botName, sourceUserId };
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

export function mapFeedEntry(raw: any, time: number): FeedEntry | undefined {
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
        text: rawMessageText(message),
        threadTs:
          message.thread_ts && message.thread_ts !== message.ts ? message.thread_ts : undefined,
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
