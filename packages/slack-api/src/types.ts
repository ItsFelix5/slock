import type { Block } from "./blocks";

export interface UserCustomField {
  id: string;
  value: string;
  alt?: string;
}

export interface User {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl?: string;
  initials: string;
  presence: "active" | "away";
  title?: string;
  pronouns?: string;
  statusText?: string;
  statusEmoji?: string;
  isBot?: boolean;
  tz?: string;
  tzLabel?: string;
  email?: string;
  phone?: string;
  customFields?: UserCustomField[];
}

export interface ProfileFieldDef {
  id: string;
  label: string;
}

export interface Reaction {
  name: string;
  count: number;
  users: string[];
}

export interface SlackFile {
  id: string;
  name: string;
  title?: string;
  mimetype?: string;
  filetype?: string;
  size?: number;
  isImage: boolean;
  urlPrivate: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  permalink?: string;
}

export interface Attachment {
  id?: number;
  color?: string;
  authorName?: string;
  authorIcon?: string;
  title?: string;
  titleLink?: string;
  text?: string;
  imageUrl?: string;
  footer?: string;
  footerIcon?: string;
  fields?: { title: string; value: string; short?: boolean }[];
}

// Most chat.postMessage-shaped events have no subtype. A handful of "content"
// subtypes (bot messages, file shares, thread broadcasts) still render as a
// normal message row; "system" subtypes (join/leave/topic/pin notices) render
// as a small centered line instead of a chat bubble.
export type MessageKind = "normal" | "system";

export interface Message {
  id: string;
  ts: string;
  userId: string;
  text: string;
  blocks?: Block[];
  files?: SlackFile[];
  attachments?: Attachment[];
  time: string;
  day: string;
  replyCount?: number;
  replyUsers?: string[];
  reactions?: Reaction[];
  editedLocally?: boolean;
  deleted?: boolean;
  kind: MessageKind;
  botName?: string;
  botIcon?: string;
}

export interface CanvasInfo {
  fileId: string;
  isEmpty: boolean;
}

export interface Channel {
  id: string;
  name: string;
  private: boolean;
  topic: string;
  unread: boolean;
  mentions?: number;
  canvas?: CanvasInfo;
}

export interface DirectMessage {
  id: string;
  userId: string;
  unread: boolean;
  lastActivity?: number;
}

export interface BrowsableChannel {
  id: string;
  name: string;
  private: boolean;
  topic: string;
  memberCount?: number;
}

export interface ChannelSection {
  id: string;
  name: string;
  channelIds: string[];
}

export interface ActivityItem {
  id: string;
  kind:
    | "mention"
    | "reaction"
    | "dm"
    | "thread_reply"
    | "channel_mention"
    | "usergroup_mention"
    | "channel_all";
  channelId: string;
  ts: string;
  userId: string;
  text: string;
  time: number;
  reactionName?: string;
  broadcastRange?: "channel" | "here";
  usergroupId?: string;
}

export interface SavedItem {
  channelId: string;
  ts: string;
}
