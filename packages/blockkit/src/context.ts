import { createContext, type JSX, useContext } from "solid-js";

// Decouples mrkdwn's <Mention> from the host app's store: blockkit never imports app
// state directly, it just asks whoever mounts BlockKit (or Mrkdwn) to resolve mention
// ids to display names and to handle mention clicks.
export interface BlockKitMentionInfo {
  isMember?: boolean;
  // Channel mentions only: true for private channels, so they render with a
  // lock icon instead of "#". When private and `isMember` is false, the mention
  // also renders dimmed/non-clickable — the viewer has no way to open it.
  isPrivate?: boolean;
  // True when this mention refers to the viewing user, so it can be rendered
  // as a "pings you" highlight rather than a plain, non-pinging mention.
  isSelf?: boolean;
  name: string;
}

export interface BlockKitResolver {
  onChannelClick(id: string): void;
  onUserClick(id: string): void;
  resolveChannel(id: string): BlockKitMentionInfo | undefined;
  resolveUser(id: string): BlockKitMentionInfo | undefined;
  resolveUsergroup(id: string): BlockKitMentionInfo | undefined;
  // Lets the host app wrap a rendered #channel mention in its own hover preview
  // (e.g. topic + join button) without blockkit depending on app-level state.
  wrapChannelMention?(id: string, trigger: JSX.Element): JSX.Element;
  // Lets the host app wrap a rendered <a> link — e.g. to add a hover preview
  // when the url is a permalink to another message — without blockkit
  // depending on app-level state or knowing what a "permalink" is.
  wrapLink?(url: string, trigger: JSX.Element): JSX.Element;
  // Same as wrapChannelMention, for @user mentions.
  wrapUserMention?(id: string, trigger: JSX.Element): JSX.Element;
}

const defaultNoopResolver: BlockKitResolver = {
  onChannelClick: () => {},
  onUserClick: () => {},
  resolveChannel: () => undefined,
  resolveUser: () => undefined,
  resolveUsergroup: () => undefined,
};

export const BlockKitResolverContext = createContext<BlockKitResolver>(defaultNoopResolver);

export function useBlockKitResolver(): BlockKitResolver {
  return useContext(BlockKitResolverContext);
}
