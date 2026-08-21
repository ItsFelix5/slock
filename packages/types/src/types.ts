import type { Block } from "./blocks";

export interface UserCustomField {
  alt?: string;
  id: string;
  value: string;
}

export interface UserProfile {
  customFields?: UserCustomField[];
  startDate?: string;
}

export interface User {
  appId?: string;
  avatarColor: string;
  avatarUrl?: string;
  botId?: string;
  customFields?: UserCustomField[];
  email?: string;
  id: string;
  isBot?: boolean;

  isWorkspaceAdmin?: boolean;

  lastSeen?: number;
  name: string;
  originalName?: string;
  phone?: string;

  presence?: "active" | "away";
  pronouns?: string;
  startDate?: string;
  statusEmoji?: string;
  statusText?: string;
  title?: string;
  tz?: string;
  tzLabel?: string;
}

export interface Usergroup {
  id: string;

  name: string;
}

export interface UsergroupDetails {
  channelIds: string[];
  createdBy?: string;
  dateCreate?: number;
  description: string;
  handle: string;
  id: string;
  isSection: boolean;
  memberCount: number;
  memberIds: string[];
  title: string;
}

export interface ProfileFieldDef {
  fieldName?: string;
  id: string;
  label: string;
}

export interface CanvasListItem {
  fileId: string;
  title: string;
}

export interface Reaction {
  count: number;
  name: string;
  users: string[];
}

export interface SlackFile {
  created?: number;
  duration?: number;
  filetype?: string;
  height?: number;
  id: string;
  isAudio?: boolean;
  isImage: boolean;
  isMail?: boolean;
  isPdf?: boolean;
  isVideo?: boolean;
  mimetype?: string;
  name: string;
  permalink?: string;
  size?: number;

  thumbTiny?: string;
  thumbUrl?: string;
  title?: string;

  transcriptionHasMore?: boolean;
  transcriptionLines?: { endMs: number; startMs: number; text: string }[];
  transcriptionPreview?: string;
  urlPrivate: string;

  vtt?: string;
  waveform?: number[];
  width?: number;
}

export interface SlackLink {
  iconUrl?: string;
  thumbHeight?: number;
  thumbUrl?: string;
  thumbWidth?: number;
  title: string | null;

  ts: string;
  url: string;
}

export interface SlackFileShare {
  channelId: string;
  channelName: string;
  replyCount?: number;
  sharedByUserId?: string;
  threadTs?: string;
  ts: string;
}

export interface SlackFileDetail {
  content: string | null;
  contentTruncated: boolean;
  file: SlackFile;
  shares: SlackFileShare[];
}

export interface Attachment {
  actions?: AttachmentAction[];
  authorIcon?: string;
  authorName?: string;

  blocks?: Block[];
  callbackId?: string;

  channelId?: string;
  color?: string;

  fallback?: string;
  fields?: { title: string; value: string; short?: boolean }[];

  files?: SlackFile[];
  footer?: string;
  footerIcon?: string;

  fromUrl?: string;
  id?: number;
  imageHeight?: number;
  imageUrl?: string;
  imageWidth?: number;

  isMessageUnfurl?: boolean;

  postedAt?: string;

  pretext?: string;
  text?: string;
  title?: string;
  titleLink?: string;
  ts?: string;
  videoHeight?: number;
  videoUrl?: string;
  videoWidth?: number;
}

export interface AttachmentAction {
  name: string;
  style?: string;
  text: string;
  url?: string;
  value?: string;
}

export type MessageKind = "normal" | "system";

export interface Message {
  attachments?: Attachment[];
  blocks?: Block[];
  botIcon?: string;

  botId?: string;
  botName?: string;
  day: string;
  deleted?: boolean;
  edited?: boolean;
  files?: SlackFile[];
  id: string;
  isBroadcast?: boolean;

  isEphemeral?: boolean;
  isSaved?: boolean;

  isSubscribed?: boolean;
  kind: MessageKind;
  lastReplyLabel?: string;
  reactions?: Reaction[];
  replyCount?: number;
  replyUsers?: string[];
  sourceUserId?: string;
  text: string;

  threadRoot?: Message;

  threadTs?: string;
  time: string;
  ts: string;
  userId: string;
}

export interface Channel {
  archived: boolean;
  id: string;
  lastActivity?: number;
  memberCount?: number;
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
  name?: string;
  unread: boolean;

  userId?: string;
  memberIds?: string[];
}

export interface ChannelDetails {
  archived: boolean;
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

export interface MemberPermissionsPatch {
  invite?: boolean;
  setPurpose?: boolean;
  setTopic?: boolean;
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

  sidebar: "hid" | "active" | "all";

  sort?: "recent";

  type: string;
}

export interface MessageShortcut {
  actionId: string;
  appId: string;
  appName: string;
  description?: string;
  icon?: string;
  name: string;
}
