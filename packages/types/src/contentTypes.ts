import type { Block } from "./blocks/blocks";
import type { SlackFile } from "./fileTypes";
import type { ChannelId, Ts, UserId } from "./ids";

export interface ActivityItem {
  botIcon?: string;
  botId?: string;

  botName?: string;
  blocks?: Block[];
  broadcastRange?: "channel" | "here" | "everyone";
  channelId: ChannelId;
  files?: SlackFile[];
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
  feedTs?: Ts;
  linkedItemId?: string;

  reactionName?: string;
  reminderNote?: string;
  text: string;

  threadTs?: Ts;
  time: number;
  ts: Ts;
  unread?: boolean;

  unreadCount?: number;
  usergroupId?: string;
  userId: UserId;
}

export interface SavedItem {
  channelId: ChannelId;
  dateCreated?: number;
  dateDue?: number;
  ts: Ts;
}
