import type { IconName } from "@slock/ui";
import type { Channel, DirectMessage, User } from "./api";

export function channelDisplayName(
  channel: Pick<Channel, "id" | "name" | "private"> | undefined,
  fallbackId?: string,
): string {
  const name = channel?.name?.trim();
  if (name) return name;
  const id = channel?.id ?? fallbackId ?? "";
  return id;
}

export function channelIconName(isPrivate: boolean | undefined): IconName {
  return isPrivate ? "lock" : "channel";
}

export function dmDisplayName(
  dm: DirectMessage | undefined,
  userById: (id: string) => User | undefined,
): string {
  if (!dm) return "";
  if (dm.name) return dm.name;
  if (dm.userId) return userById(dm.userId)?.name ?? "";
  if (dm.memberIds?.length) {
    return dm.memberIds.map((id) => userById(id)?.name ?? "Someone").join(", ");
  }
  return "";
}

export function conversationDisplayName(
  id: string,
  channelById: (id: string) => Pick<Channel, "id" | "name" | "private"> | undefined,
  dmById: (id: string) => DirectMessage | undefined,
  userById: (id: string) => User | undefined,
): string {
  const dm = dmById(id);
  if (dm) return dmDisplayName(dm, userById) || id;
  return `#${channelDisplayName(channelById(id), id)}`;
}
