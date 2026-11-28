import type { Block } from "./blocks/blocks";
import type { ChannelId, FileId, Ts, UserId } from "./ids";

export interface SlackFile {
  created?: number;
  duration?: number;
  filetype?: string;
  height?: number;
  id: FileId;
  isAudio?: boolean;
  isDeleted?: boolean;
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
  urlPrivateDownload?: string;
  userId?: UserId;

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
  ts: Ts;
  url: string;
}

export interface SlackFileShare {
  access?: string;
  channelId: ChannelId;
  channelName: string;
  replyCount?: number;
  sharedByUserId?: UserId;
  threadTs?: Ts;
  ts: Ts;
}

interface SlackFileAccess {
  canManage: boolean;
  channels: { access: string; channelId: ChannelId; name?: string; private?: boolean }[];
  hiddenChannelCount: number;
  orgId: string;
  orgLevel: string;
  orgName?: string;
  users: { access: string; editHeldBy?: "channel" | "org"; userId: UserId }[];
}

export interface SlackFileDetail {
  access: SlackFileAccess | null;
  content: string | null;
  contentTruncated: boolean;
  editable: boolean;
  file: SlackFile;
  shares: SlackFileShare[];
  starred: boolean;
  viewerCount: number | null;
}

export interface Attachment {
  actions?: AttachmentAction[];
  authorIcon?: string;
  authorId?: UserId;
  authorLink?: string;
  authorName?: string;
  authorSubname?: string;

  blocks?: Block[];
  botId?: string;
  botTeamId?: string;
  callbackId?: string;

  channelId?: ChannelId;
  color?: string;
  embedUrl?: string;

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
  serviceIcon?: string;
  serviceName?: string;
  text?: string;
  title?: string;
  titleLink?: string;
  ts?: Ts;
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

export interface PendingFile {
  id: string;
  isImage: boolean;
  name: string;
  previewUrl?: string;
  progress: number;
  size: number;
}
