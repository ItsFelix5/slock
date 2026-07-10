import type { Block } from "./blocks";

interface UserCustomField {
  id: string;
  value: string;
  alt?: string;
}

export interface User {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl?: string;
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
  isVideo?: boolean;
  urlPrivate: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
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
  videoUrl?: string;
  videoWidth?: number;
  videoHeight?: number;
  footer?: string;
  footerIcon?: string;
  fields?: { title: string; value: string; short?: boolean }[];
  // Set when this attachment is Slack's own auto-unfurl of a permalink found
  // in the message text, with `ts` identifying which message it unfurled —
  // used to suppress the redundant native unfurl of our own reply-link.
  isMessageUnfurl?: boolean;
  ts?: string;
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
  lastReplyLabel?: string;
  reactions?: Reaction[];
  edited?: boolean;
  deleted?: boolean;
  kind: MessageKind;
  botName?: string;
  botIcon?: string;
  isBroadcast?: boolean;
  // Root ts of the thread this reply belongs to, when different from its own
  // ts — set for broadcasted replies so the channel view can show the thread
  // context they were sent from.
  threadTs?: string;
  // chat.postEphemeral responses (e.g. slash command output) — only ever
  // delivered to the user they're meant for, never part of real history.
  isEphemeral?: boolean;
  // Whether the current user is following this thread for new-reply
  // notifications — only ever set on the thread's root message, mirroring
  // where conversations.replies puts the `subscribed` field.
  isSubscribed?: boolean;
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

export interface ChannelTab {
  type: string;
  label?: string;
}

export interface ChannelDetails {
  id: string;
  name: string;
  private: boolean;
  topic: string;
  purpose: string;
  created: number;
  creatorId?: string;
  memberCount?: number;
  tabs: ChannelTab[];
  email?: string;
}

export interface ChannelMembersPage {
  members: User[];
  nextCursor?: string;
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

// A per-message "app shortcut" (Slack's Interactivity & Shortcuts > Message
// Shortcuts) — installed apps that can act on a message from its ⋯ menu.
export interface MessageShortcut {
  actionId: string;
  appId: string;
  appName: string;
  name: string;
  description?: string;
  icon?: string;
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
  // Root ts of the thread this happened in, when different from `ts` (e.g. a
  // thread_reply's own message ts vs. the parent it replied to).
  threadTs?: string;
}

export interface SavedItem {
  channelId: string;
  ts: string;
}

// A client-side stand-in for a Slack unfurl, shown in the composer before
// send — see fetchLinkPreview.
export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}
