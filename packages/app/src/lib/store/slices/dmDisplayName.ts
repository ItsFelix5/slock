import type { DirectMessage, User } from "@slock/slack-api";

// A regular DM resolves to its one other participant's name. Multi-person DMs
// use Slack's conversation name only when it's a real custom name (dm.name is
// only populated for those, see fetchBootstrap's has_custom_mpdm_name check) —
// otherwise they're built from participants' real names, since Slack's
// auto-generated name is made of usernames, which can differ from display names.
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
