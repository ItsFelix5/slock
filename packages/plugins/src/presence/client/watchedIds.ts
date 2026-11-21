import { SLACK_USER_ID } from "@slock/slack";
import type { DirectMessage, UserId } from "@slock/types";

export function watchedUserIds(
  dms: Pick<DirectMessage, "memberIds" | "userId">[],
  selfId: UserId | undefined,
): UserId[] {
  const ids = new Set<UserId>();
  for (const dm of dms) {
    if (dm.userId) ids.add(dm.userId);
    for (const id of dm.memberIds ?? []) ids.add(id);
  }
  if (selfId) ids.add(selfId);

  ids.delete(SLACK_USER_ID);
  return [...ids];
}
