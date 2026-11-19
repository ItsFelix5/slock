import type { Block } from "./blocks/blocks";
import type { Attachment, PendingFile, SlackFile } from "./fileTypes";
import type { ChannelId, FileId, Ts, UserId } from "./ids";
import type { User } from "./userTypes";
import type { RawMessage } from "./wire/rawTypes";

export interface CanvasListItem {
  fileId: FileId;
  title: string;
}

export interface Reaction {
  count: number;
  name: string;
  users: UserId[];
}

export type MessageKind = "normal" | "system";

export interface Message {
  attachments?: Attachment[];
  blocks?: Block[];
  botIcon?: string;

  botId?: string;
  botName?: string;
  canvasThreadId?: string;
  day: string;
  deleted?: boolean;
  edited?: boolean;
  editHistory?: string[];
  files?: SlackFile[];
  id: Ts;
  pending?: boolean;
  pendingFiles?: PendingFile[];
  isBroadcast?: boolean;

  isEphemeral?: boolean;
  isSaved?: boolean;

  isLocked?: boolean;
  isSubscribed?: boolean;
  kind: MessageKind;
  lastReplyLabel?: string;
  latestReply?: Ts;
  metadata?: RawMessage["metadata"];
  reactions?: Reaction[];
  replyCount?: number;
  replyUsers?: UserId[];
  subtype?: string;
  text: string;

  threadLastRead?: Ts;
  threadRoot?: Message;

  threadTs?: Ts;
  time: string;
  ts: Ts;
  userId: UserId | undefined;
}

export interface Channel {
  archived: boolean;
  canvasFileId?: FileId;
  id: ChannelId;
  lastActivity?: number;
  memberCount?: number;
  mentions?: number;
  name: string;
  private: boolean;
  topic: string;
  unread: boolean;
}

export interface DirectMessage {
  id: ChannelId;
  lastActivity?: number;
  mentions?: number;
  name?: string;
  unread: boolean;

  userId?: UserId;
  memberIds?: UserId[];
}

export interface ChannelDetails {
  archived: boolean;
  created: number;
  creatorId?: UserId;
  email?: string;
  id: ChannelId;
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
  id: ChannelId;
  memberCount?: number;
  name: string;
  private: boolean;
  topic: string;
}

export interface ChannelSection {
  channelIds: ChannelId[];
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
