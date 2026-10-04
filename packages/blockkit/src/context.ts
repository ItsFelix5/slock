import type { Attachment } from "@slock/types";
import { createContext, type JSX, useContext } from "solid-js";

export interface BlockKitMentionInfo {
  isMember?: boolean;

  isPrivate?: boolean;

  isSelf?: boolean;
  name: string;
}

export interface BlockKitResolver {
  onCanvasClick(fileId: string, title?: string): void;
  onChannelClick(id: string): void;
  onUserClick(id: string): void;
  onUsergroupClick(id: string): void;
  resolveCanvasTitle(fileId: string): string | undefined;
  resolveChannel(id: string): BlockKitMentionInfo | undefined;
  resolveUser(id: string): BlockKitMentionInfo | undefined;
  resolveUsergroup(id: string): BlockKitMentionInfo | undefined;

  wrapChannelMention?(id: string, trigger: JSX.Element): JSX.Element;

  wrapLink?(url: string, trigger: JSX.Element, attachments?: Attachment[]): JSX.Element;

  wrapUserMention?(id: string, trigger: JSX.Element): JSX.Element;

  wrapUsergroupMention?(id: string, trigger: JSX.Element): JSX.Element;
}

const defaultNoopResolver: BlockKitResolver = {
  onCanvasClick: () => {},
  onChannelClick: () => {},
  onUserClick: () => {},
  onUsergroupClick: () => {},
  resolveCanvasTitle: () => undefined,
  resolveChannel: () => undefined,
  resolveUser: () => undefined,
  resolveUsergroup: () => undefined,
};

export const BlockKitResolverContext = createContext<BlockKitResolver>(defaultNoopResolver);

export function useBlockKitResolver(): BlockKitResolver {
  return useContext(BlockKitResolverContext);
}

export interface TimeAnchor {
  ms: number;
  tz?: string;
}

export const TimeAnchorContext = createContext<TimeAnchor | undefined>(undefined);

export function useTimeAnchor(): TimeAnchor | undefined {
  return useContext(TimeAnchorContext);
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

export const EmojiFreezeContext = createContext<() => boolean>(() => false);

export function useEmojiFreeze(): () => boolean {
  return useContext(EmojiFreezeContext);
}
