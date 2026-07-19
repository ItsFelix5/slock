import type { Block } from "./blocks";

interface UserCustomField {
  alt?: string;
  id: string;
  value: string;
}

export interface User {
  // Only present for bot users — the parent app's id and classic bot id,
  // needed together to look up the app's description (see fetchAppDescription).
  appId?: string;
  avatarColor: string;
  avatarUrl?: string;
  botId?: string;
  customFields?: UserCustomField[];
  email?: string;
  id: string;
  isBot?: boolean;
  name: string;
  phone?: string;
  presence: "active" | "away";
  pronouns?: string;
  statusEmoji?: string;
  statusText?: string;
  title?: string;
  tz?: string;
  tzLabel?: string;
}

export interface Usergroup {
  id: string;
  // Slack's `handle` is the value people actually mention (for example,
  // `@on-call`), while `name` is a human-readable title. Store the mention
  // label here so message renderers can display it without knowing that API
  // distinction.
  name: string;
}

export interface UsergroupDetails {
  channelIds: string[];
  createdBy?: string;
  dateCreate?: number;
  description: string;
  handle: string;
  id: string;
  memberCount: number;
  memberIds: string[];
  title: string;
}

export interface ProfileFieldDef {
  id: string;
  label: string;
}

export interface Reaction {
  count: number;
  name: string;
  users: string[];
}

export interface SlackFile {
  duration?: number;
  filetype?: string;
  height?: number;
  id: string;
  isAudio?: boolean;
  isImage: boolean;
  isVideo?: boolean;
  mimetype?: string;
  name: string;
  permalink?: string;
  size?: number;
  thumbUrl?: string;
  title?: string;
  // Slack's speech-to-text preview for voice messages — truncated, with
  // `transcriptionHasMore` set when the full transcript runs longer.
  transcriptionHasMore?: boolean;
  transcriptionPreview?: string;
  urlPrivate: string;
  // Per-sample amplitude (0-100) Slack renders as the voice-message waveform.
  waveform?: number[];
  width?: number;
}

export interface Attachment {
  authorIcon?: string;
  authorName?: string;
  // Rich-text body of a message-unfurl attachment (legacy attachments carry
  // their own `blocks`, separate from a real Message's).
  blocks?: Block[];
  // Channel the unfurled message was posted in, for the "Posted in #channel" line.
  channelId?: string;
  color?: string;
  // Legacy summary used as the body when an attachment omits blocks and text.
  fallback?: string;
  fields?: { title: string; value: string; short?: boolean }[];
  // Files attached to the unfurled message itself (distinct from this
  // attachment's own imageUrl/videoUrl), e.g. sharing a permalink to a
  // message that has an uploaded image or file.
  files?: SlackFile[];
  footer?: string;
  footerIcon?: string;
  // Permalink to the unfurled message, for the "View message" link.
  fromUrl?: string;
  id?: number;
  imageUrl?: string;
  // Set when this attachment is Slack's own auto-unfurl of a permalink found
  // in the message text, with `ts` identifying which message it unfurled —
  // used to suppress the redundant native unfurl of our own reply-link.
  isMessageUnfurl?: boolean;
  // "Today at 11:01 AM"-style label for a message-unfurl's original send time.
  postedAt?: string;
  // Text shown immediately above a legacy attachment's bordered content.
  pretext?: string;
  text?: string;
  title?: string;
  titleLink?: string;
  ts?: string;
  videoHeight?: number;
  videoUrl?: string;
  videoWidth?: number;
}

// Most chat.postMessage-shaped events have no subtype. A handful of "content"
// subtypes (bot messages, file shares, thread broadcasts) still render as a
// normal message row; "system" subtypes (join/leave/topic/pin notices) render
// as a small centered line instead of a chat bubble.
export type MessageKind = "normal" | "system";

export interface Message {
  attachments?: Attachment[];
  blocks?: Block[];
  botIcon?: string;
  // The classic "B..." bot/service id — present on app-posted messages,
  // needed to resolve which app owns a Block Kit button so its click can be
  // dispatched (see runBlockAction).
  botId?: string;
  botName?: string;
  day: string;
  deleted?: boolean;
  edited?: boolean;
  files?: SlackFile[];
  id: string;
  isBroadcast?: boolean;
  // chat.postEphemeral responses (e.g. slash command output) — only ever
  // delivered to the user they're meant for, never part of real history.
  isEphemeral?: boolean;
  isSaved?: boolean;
  // Whether the current user is following this thread for new-reply
  // notifications — only ever set on the thread's root message, mirroring
  // where conversations.replies puts the `subscribed` field.
  isSubscribed?: boolean;
  kind: MessageKind;
  lastReplyLabel?: string;
  reactions?: Reaction[];
  replyCount?: number;
  replyUsers?: string[];
  text: string;
  // Slack includes this rendering-ready copy of the parent on broadcast replies.
  threadRoot?: Message;
  // Root ts of the thread this reply belongs to, when different from its own
  // ts — set for broadcasted replies so the channel view can show the thread
  // context they were sent from.
  threadTs?: string;
  time: string;
  ts: string;
  userId: string;
}

export interface CanvasInfo {
  fileId: string;
  isEmpty: boolean;
}

export interface Channel {
  canvas?: CanvasInfo;
  id: string;
  mentions?: number;
  name: string;
  private: boolean;
  topic: string;
  unread: boolean;
}

export interface DirectMessage {
  id: string;
  lastActivity?: number;
  mentions?: number;
  unread: boolean;
  // Exactly one of these is set: userId for a regular 1:1 DM, memberIds
  // (everyone but the current user) for a multi-person DM.
  userId?: string;
  memberIds?: string[];
}

export interface ChannelDetails {
  created: number;
  creatorId?: string;
  email?: string;
  id: string;
  memberCount?: number;
  name: string;
  private: boolean;
  purpose: string;
  topic: string;
}

export interface ChannelMembersPage {
  members: User[];
  nextCursor?: string;
}

export interface BrowsableChannel {
  id: string;
  memberCount?: number;
  name: string;
  private: boolean;
  topic: string;
}

export interface ChannelSection {
  channelIds: string[];
  id: string;
  name: string;
  // Sidebar display preference returned by users.channelSections.list.
  // "hid" (and Slack's older "hide" spelling) means unread-only.
  sidebar: "hid" | "active" | "all";
  // "standard" is a real user-created section; everything else is one of
  // Slack's fixed built-in pseudo-sections ("stars", "channels",
  // "direct_messages", ...). Membership operations (move channel into
  // section) only make sense for "standard" — callers must filter on that.
  type: string;
}

// A per-message "app shortcut" (Slack's Interactivity & Shortcuts > Message
// Shortcuts) — installed apps that can act on a message from its ⋯ menu.
export interface MessageShortcut {
  actionId: string;
  appId: string;
  appName: string;
  description?: string;
  icon?: string;
  name: string;
}

export interface ActivityItem {
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
    | "keyword";
  // The pingword that matched, for kind "keyword" — surfaced from
  // all_notifications_prefs.global.global_keywords.
  matchedKeyword?: string;
  reactionName?: string;
  text: string;
  // Root ts of the thread this happened in, when different from `ts` (e.g. a
  // thread_reply's own message ts vs. the parent it replied to).
  threadTs?: string;
  time: number;
  ts: string;
  // For kind "thread_reply": Slack bundles every unread reply since your last
  // visit into a single feed entry, only ever exposing the latest one's ts —
  // this is bundle_info's own count of how many replies that single entry
  // actually represents, so callers can go fetch the rest.
  unreadCount?: number;
  usergroupId?: string;
  userId: string;
}

export interface SavedItem {
  channelId: string;
  ts: string;
}

// A client-side stand-in for a Slack unfurl, shown in the composer before
// send — see fetchLinkPreview.
export interface LinkPreview {
  description?: string;
  imageUrl?: string;
  siteName?: string;
  title?: string;
  url: string;
}
