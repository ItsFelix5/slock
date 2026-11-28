import type { Block } from "./blocks/blocks";
import type { Attachment, SlackFile } from "./fileTypes";
import type { ChannelId, TeamId, Ts, UserId } from "./ids";

export interface ActivityItem {
  attachments?: Attachment[];
  botIcon?: string;
  botId?: string;

  botName?: string;
  botTeamId?: TeamId;
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
