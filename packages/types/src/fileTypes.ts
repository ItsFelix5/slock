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

export interface SlackFileAccess {
  orgId: string | null;
  orgLevel: string;
  users: { access: string; userId: UserId }[];
}

export interface SlackFileDetail {
  access: SlackFileAccess;
  content: string | null;
  contentTruncated: boolean;
  editable: boolean;
  file: SlackFile;
  ownerId: UserId | null;
  shares: SlackFileShare[];
  starred: boolean;
  viewerCount: number | null;
}

export interface Attachment {
  actions?: AttachmentAction[];
  authorIcon?: string;
  authorId?: UserId;
  authorName?: string;
  authorSubname?: string;

  blocks?: Block[];
  callbackId?: string;

  channelId?: ChannelId;
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
