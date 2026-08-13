export const ACTIVITY_FEED_TYPES = [
  "at_user",
  "at_user_group",
  "at_channel",
  "at_everyone",
  "keyword",
  "list_record_assigned",
  "list_user_mentioned",
  "list_todo_notification",
  "list_approval_request",
  "list_approval_reviewed",
  "unjoined_channel_mention",
  "thread_v2",
  "message_reaction",
  "bot_dm_bundle",
  "dm",
  "internal_channel_invite",
  "external_channel_invite",
  "external_dm_invite",
  "quietly_added_to_channel",
  "channel",
  "saved_reminder",
  "list_record_edited",
] as const;

export const ACTIVITY_FEED_TYPES_PARAM = ACTIVITY_FEED_TYPES.join(",");

export interface ActivityItem {
  botIcon?: string;
  botId?: string;

  botName?: string;
  broadcastRange?: "channel" | "here" | "everyone";
  channelId: string;
  id: string;
  kind:
    | "mention"
    | "reaction"
    | "dm"
    | "thread_reply"
    | "channel_mention"
    | "usergroup_mention"
    | "channel_all"
    | "keyword"
    | "other";
  activityType?: string;
  feedTs?: string;

  matchedKeyword?: string;
  reactionName?: string;
  text: string;

  threadTs?: string;
  time: number;
  ts: string;
  unread?: boolean;

  unreadCount?: number;
  usergroupId?: string;
  userId: string;
}

export interface SavedItem {
  channelId: string;
  ts: string;
}

export interface LinkPreview {
  description?: string;
  imageUrl?: string;
  siteName?: string;
  title?: string;
  url: string;
}
