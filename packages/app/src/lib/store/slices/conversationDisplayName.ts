import type { Channel, DirectMessage, User } from "@slock/slack-api";
import { channelDisplayName } from "./channelDisplayName";
import { dmDisplayName } from "./dmDisplayName";

export function conversationDisplayName(
  id: string,
  channel: Pick<Channel, "id" | "name" | "private"> | undefined,
  dm: DirectMessage | undefined,
  userById: (id: string) => User | undefined,
): string {
  if (dm) return dmDisplayName(dm, userById) || id;
  return `#${channelDisplayName(channel, id)}`;
}
