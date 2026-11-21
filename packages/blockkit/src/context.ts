import type { Attachment, ChannelId, FileId, UserId } from "@slock/types";
import type { JSX } from "@solidjs/web";
import { createContext, useContext } from "solid-js";

export interface BlockKitMentionInfo {
  isMember?: boolean;

  isPrivate?: boolean;

  label?: string;

  isSelf?: boolean;
  name: string;
}

export interface BlockKitResolver {
  onCanvasClick(fileId: FileId, title?: string): void;
  onChannelClick(id: ChannelId): void;
  onUserClick(id: UserId): void;
  onUsergroupClick(id: string): void;
  resolveCanvasTitle(fileId: FileId): string | undefined;
  resolveChannel(id: ChannelId): BlockKitMentionInfo | undefined;
  resolveUser(id: UserId): BlockKitMentionInfo | undefined;
  resolveUsergroup(id: string): BlockKitMentionInfo | undefined;

  wrapChannelMention?(id: ChannelId, trigger: JSX.Element): JSX.Element;

  wrapLink?(url: string, trigger: JSX.Element, attachments?: Attachment[]): JSX.Element;

  wrapUserMention?(id: UserId, trigger: JSX.Element): JSX.Element;

  wrapUsergroupMention?(id: string, trigger: JSX.Element): JSX.Element;
}

export const noopBlockKitResolver: BlockKitResolver = {
  onCanvasClick: () => {},
  onChannelClick: () => {},
  onUserClick: () => {},
  onUsergroupClick: () => {},
  resolveCanvasTitle: () => undefined,
  resolveChannel: () => undefined,
  resolveUser: () => undefined,
  resolveUsergroup: () => undefined,
};

export const BlockKitResolverContext = createContext<BlockKitResolver>(noopBlockKitResolver);

export function useBlockKitResolver(): BlockKitResolver {
  return useContext(BlockKitResolverContext);
}

export interface TimeAnchor {
  ms: number;
  tz?: string;
}

export const TimeAnchorContext = createContext<TimeAnchor | null>(null);

export function useTimeAnchor(): TimeAnchor | undefined {
  return useContext(TimeAnchorContext) ?? undefined;
}

export const HighlightWordsContext = createContext<() => string[]>(() => []);

export function useHighlightWords(): () => string[] {
  return useContext(HighlightWordsContext);
}

export const MessageAttachmentsContext = createContext<() => Attachment[] | undefined>(
  () => undefined,
);

export function useMessageAttachments(): () => Attachment[] | undefined {
  return useContext(MessageAttachmentsContext);
}

export const InertTokensContext = createContext(false);

export function useInertTokens(): boolean {
  return useContext(InertTokensContext);
}

export const EmojiFreezeContext = createContext<() => boolean>(() => false);

export function useEmojiFreeze(): () => boolean {
  return useContext(EmojiFreezeContext);
}

export type BlockKitConfirm = (options: {
  cancelLabel?: string;
  confirmLabel?: string;
  danger?: boolean;
  message: string;
  title?: string;
}) => Promise<boolean>;

export const BlockKitConfirmContext = createContext<BlockKitConfirm>(() => Promise.resolve(false));

export function useBlockKitConfirm(): BlockKitConfirm {
  return useContext(BlockKitConfirmContext);
}
