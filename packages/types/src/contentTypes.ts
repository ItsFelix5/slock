import type { Block } from "./blocks";
import type { SlackFile } from "./fileTypes";

export interface ActivityItem {
  botIcon?: string;
  botId?: string;

  botName?: string;
  blocks?: Block[];
  broadcastRange?: "channel" | "here" | "everyone";
  channelId: string;
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
  feedTs?: string;
  linkedItemId?: string;

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
