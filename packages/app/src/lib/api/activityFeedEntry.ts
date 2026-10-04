import type {
  ACTIVITY_FEED_TYPES,
  ActivityItem,
  FeedEntry,
  RawActivityFeedEntry,
  RawActivityItem,
  RawActivityMessage,
} from "@slock/types";
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

const ACTIVITY_TYPE_KINDS_BY_STRING: Record<string, ActivityItem["kind"] | undefined> =
  ACTIVITY_TYPE_KINDS;

function activityKindFor(type: string): ActivityItem["kind"] {
  return ACTIVITY_TYPE_KINDS_BY_STRING[type] ?? "other";
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

function rawMessageUserId(message: RawActivityMessage | undefined): string | undefined {
  return message?.user ?? message?.author_user_id ?? message?.bot_id;
}

function rawMessageAuthor(
  message: RawActivityMessage | undefined,
  userId: string,
): Pick<ActivityItem, "botIcon" | "botId" | "botName"> {
  if (!message?.ts || rawMessageUserId(message) !== userId) return {};
  const { botIcon, botId, botName } = mapMessage({ ...message, ts: message.ts });
  return { botIcon, botId, botName };
}

function rawActivityUserId(item: RawActivityItem): string | undefined {
  return (
    item.latest_reply_actor_user_id ??
    item.actor_user_id ??
    item.author_user_id ??
    item.latest_user_id ??
    item.user ??
    item.user_id
  );
}

const EXACT_CHANNEL_FEED_KEY_RE = /^[CG][A-Z0-9]{8,}$/;
const EMBEDDED_CHANNEL_FEED_KEY_RE = /(?:^|[^A-Z0-9])([CG][A-Z0-9]{8,})(?=$|[^A-Z0-9])/;

function channelIdFromFeedKey(key: unknown): string | undefined {
  if (typeof key !== "string") return;
  if (EXACT_CHANNEL_FEED_KEY_RE.test(key)) return key;
  return key.match(EMBEDDED_CHANNEL_FEED_KEY_RE)?.[1];
}

export function mapFeedEntry(raw: RawActivityFeedEntry, time: number): FeedEntry | undefined {
  const { item } = raw;
  const type = item?.type;
  if (!(item && type)) return;
  const kind = activityKindFor(type);
  const unread = raw.is_unread;
  const feedTs = String(raw.feed_ts);
  const id = String(raw.key ?? `${type}:${raw.feed_ts}`);
  const { message: reactedMessage, reaction } = item;
  if (type === "message_reaction" && reactedMessage?.channel && reactedMessage.ts && reaction) {
    return {
      activityType: type,
      channelId: reactedMessage.channel,
      feedTs,
      id,
      kind,
      reactionName: reaction.name,
      text: reactedMessage.text,
      threadTs:
        reactedMessage.thread_ts && reactedMessage.thread_ts !== reactedMessage.ts
          ? reactedMessage.thread_ts
          : undefined,
      time,
      ts: reactedMessage.ts,
      unread,
      userId: reaction.user ?? "",
    };
  }
  const payload = item.bundle_info?.payload;
  const thread = payload?.thread_entry;
  if (type === "thread_v2" && thread) {
    const latestMessage =
      thread.latest_message ?? thread.latest_msg ?? thread.message ?? item.message;
    const userId =
      thread.latest_reply_actor_user_id ??
      thread.latest_user_id ??
      thread.latest_reply_user_id ??
      thread.user_id ??
      rawMessageUserId(latestMessage) ??
      rawActivityUserId(item) ??
      "";
    return {
      activityType: type,
      ...rawMessageAuthor(latestMessage, userId),
      channelId: thread.channel_id ?? "",
      feedTs,
      id,
      kind,
      text: latestMessage?.text ?? item.activity_text,
      threadTs: thread.thread_ts,
      time,
      ts: thread.latest_ts ?? "",
      unread,
      unreadCount: thread.unread_msg_count,
      userId,
    };
  }
  const channelEntry = payload?.channel_entry;
  const quietlyAdded = item.quietly_added_to_channel_payload;
  const message =
    item.message ??
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
    item.channel_id ??
    item.channel ??
    item.invite ??
    sparseChannelId;
  const ts =
    message?.ts ??
    channelEntry?.latest_ts ??
    item.message_ts ??
    item.ts ??
    (quietlyAdded?.channel_id ? raw.feed_ts : undefined) ??
    (sparseChannelId ? raw.feed_ts : undefined);
  const text = message?.text ?? item.activity_text;
  if (!(channelId && ts)) {
    const userId = rawMessageUserId(message) ?? rawActivityUserId(item) ?? "";
    return {
      activityType: type,
      ...rawMessageAuthor(message, userId),
      channelId: "",
      feedTs,
      id,
      kind,
      text,
      time,
      ts: String(item.ts ?? raw.feed_ts ?? raw.key),
      unread,
      userId,
    };
  }
  const userId =
    rawMessageUserId(message) ??
    channelEntry?.latest_user_id ??
    channelEntry?.user_id ??
    item.latest_user_id ??
    rawActivityUserId(item) ??
    quietlyAdded?.inviter_user_id ??
    "";
  return {
    activityType: type,
    ...rawMessageAuthor(message, userId),
    broadcastRange:
      type === "at_everyone" ? "everyone" : type === "at_channel" ? "channel" : undefined,
    channelId,
    feedTs,
    id,
    kind,
    threadTs: message?.thread_ts && message.thread_ts !== ts ? message.thread_ts : undefined,
    time,
    ts,
    text,
    unread,
    userId,
  };
}
