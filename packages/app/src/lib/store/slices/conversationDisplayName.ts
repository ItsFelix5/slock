import type { Channel, DirectMessage, User } from "@slock/slack-api";
import { channelDisplayName } from "./channelDisplayName";
import { dmDisplayName } from "./dmDisplayName";

// An id sourced from the activity feed, desktop notifications, saved-for-later,
// a thread, or a message unfurl isn't guaranteed to be a real channel — it can
// be a DM's id (thread replies, mentions, and reactions all happen in DMs too).
// channelDisplayName alone can't resolve those because DMs live in a separate store. Use
// this instead of re-deriving the channel/DM branch at each display site.
export function conversationDisplayName(
  id: string,
  channel: Pick<Channel, "id" | "name" | "private"> | undefined,
  dm: DirectMessage | undefined,
  userById: (id: string) => User | undefined,
): string {
  if (dm) return dmDisplayName(dm, userById) || id;
  return `#${channelDisplayName(channel, id)}`;
}
