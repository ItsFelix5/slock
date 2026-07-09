import { createContext, useContext } from "solid-js";

// Decouples mrkdwn's <Mention> from the host app's store: blockkit never imports app
// state directly, it just asks whoever mounts BlockKit (or Mrkdwn) to resolve mention
// ids to display names and to handle mention clicks.
export interface BlockKitMentionInfo {
  name: string;
  // True when this mention refers to the viewing user, so it can be rendered
  // as a "pings you" highlight rather than a plain, non-pinging mention.
  isSelf?: boolean;
}

export interface BlockKitResolver {
  resolveUser(id: string): BlockKitMentionInfo | undefined;
  resolveChannel(id: string): BlockKitMentionInfo | undefined;
  onUserClick(id: string): void;
  onChannelClick(id: string): void;
}

const defaultNoopResolver: BlockKitResolver = {
  resolveUser: () => undefined,
  resolveChannel: () => undefined,
  onUserClick: () => {},
  onChannelClick: () => {},
};

export const BlockKitResolverContext = createContext<BlockKitResolver>(defaultNoopResolver);

export function useBlockKitResolver(): BlockKitResolver {
  return useContext(BlockKitResolverContext);
}
