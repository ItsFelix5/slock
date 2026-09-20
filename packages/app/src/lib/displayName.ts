import type { IconName } from "@slock/ui";
import type { Channel, DirectMessage, User } from "./api";
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

export function formatInteractorNames(
  ids: string[],
  currentUserId: string | undefined,
  userById: (id: string) => User | undefined,
): string {
  const names = ids.map((id) => (id === currentUserId ? "you" : (userById(id)?.name ?? "someone")));
  return names.reduce(
    (previous, current, index, all) =>
      (previous ? previous + (index < all.length - 1 ? ", " : " and ") : "") + current,
    "",
  );
}

export function conversationDisplayName(
  id: string,
  channelById: (id: string) => Pick<Channel, "id" | "name" | "private"> | undefined,
  dmById: (id: string) => DirectMessage | undefined,
  userById: (id: string) => User | undefined,
): string {
  const dm = dmById(id);
  if (isDmId(id, () => !!dm)) return dmDisplayName(dm, userById) || id;
  return `#${channelDisplayName(channelById(id), id)}`;
}
