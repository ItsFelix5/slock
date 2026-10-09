import type { Channel, DirectMessage, User } from "@slock/types";
import type { IconName } from "@slock/ui";
import { isDmId } from "./store/slices/entities/dms";

export function channelDisplayName(
  channel: Pick<Channel, "id" | "name" | "private"> | undefined,
  fallbackId?: string,
): string {
  const name = channel?.name?.trim();
  if (name) return name;
  const id = channel?.id ?? fallbackId ?? "";
  return id;
}

export function channelIconName(isPrivate: boolean | undefined, isArchived?: boolean): IconName {
  if (isArchived) return "archive";
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

export function formatInteractorNames(
  ids: string[],
  currentUserId: string | undefined,
  userById: (id: string) => User | undefined,
  max = ids.length,
): string {
  const names = ids.map((id) => (id === currentUserId ? "you" : (userById(id)?.name ?? "someone")));
  const shownCount = names.length - max === 1 ? names.length : max;
  const shown = names.slice(0, shownCount);
  const hidden = names.length - shownCount;
  if (hidden > 0) shown.push(`${hidden} others`);
  if (shown.length < 2) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

export function conversationDisplayName(
  id: string,
  channelById: (
    id: string,
  ) => Pick<Channel, "canvasFileId" | "id" | "name" | "private"> | undefined,
  dmById: (id: string) => DirectMessage | undefined,
  userById: (id: string) => User | undefined,
): string {
  const dm = dmById(id);
  if (isDmId(id, () => !!dm)) return dmDisplayName(dm, userById) || id;
  const channel = channelById(id);
  if (channel?.canvasFileId) return channelDisplayName(channel, id);
  return `#${channelDisplayName(channel, id)}`;
}
