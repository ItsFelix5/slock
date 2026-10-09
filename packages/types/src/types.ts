import type { Block } from "./blocks";
import type { Attachment, PendingFile, SlackFile } from "./fileTypes";
import type { RawMessage } from "./rawTypes";
import type { User } from "./userTypes";

export interface CanvasListItem {
  fileId: string;
  title: string;
}

export interface Reaction {
  count: number;
  name: string;
  users: string[];
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
  pending?: boolean;
  pendingFiles?: PendingFile[];
  isBroadcast?: boolean;

  isEphemeral?: boolean;
  isSaved?: boolean;

  isSubscribed?: boolean;
  kind: MessageKind;
  lastReplyLabel?: string;
  metadata?: RawMessage["metadata"];
  reactions?: Reaction[];
  replyCount?: number;
  replyUsers?: string[];
  text: string;

  threadRoot?: Message;

  threadTs?: string;
  time: string;
  ts: string;
  userId: string;
}

export interface Channel {
  archived: boolean;
  canvasFileId?: string;
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
