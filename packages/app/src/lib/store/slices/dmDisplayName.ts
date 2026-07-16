import type { DirectMessage, User } from "@slock/slack-api";

// A regular DM resolves to its one other participant's name; a multi-person
// DM (memberIds instead of userId — see DirectMessage) joins everyone else's
// names the way Slack's own client does ("alice, bob, carol").
export function dmDisplayName(
  dm: DirectMessage | undefined,
  userById: (id: string) => User | undefined,
): string {
  if (!dm) return "";
  if (dm.userId) return userById(dm.userId)?.name ?? "";
  if (dm.memberIds?.length) {
    return dm.memberIds.map((id) => userById(id)?.name ?? "Someone").join(", ");
  }
  return "";
}
