import { createContext, type JSX, useContext } from "solid-js";

export interface BlockKitMentionInfo {
  isMember?: boolean;

  isPrivate?: boolean;

  isSelf?: boolean;
  name: string;
}

export interface BlockKitResolver {
  onChannelClick(id: string): void;
  onUserClick(id: string): void;
  onUsergroupClick(id: string): void;
  resolveChannel(id: string): BlockKitMentionInfo | undefined;
  resolveUser(id: string): BlockKitMentionInfo | undefined;
  resolveUsergroup(id: string): BlockKitMentionInfo | undefined;

  wrapChannelMention?(id: string, trigger: JSX.Element): JSX.Element;

  wrapLink?(url: string, trigger: JSX.Element): JSX.Element;

  wrapUserMention?(id: string, trigger: JSX.Element): JSX.Element;

  wrapUsergroupMention?(id: string, trigger: JSX.Element): JSX.Element;
}

const defaultNoopResolver: BlockKitResolver = {
  onChannelClick: () => {},
  onUserClick: () => {},
  onUsergroupClick: () => {},
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
