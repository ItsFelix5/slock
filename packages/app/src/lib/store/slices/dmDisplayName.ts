import type { DirectMessage, User } from "@slock/slack-api";

// A regular DM resolves to its one other participant's name. Multi-person DMs
// use Slack's conversation name when available, otherwise their participant names.
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
