import type { User, UserId } from "@slock/types";

type SelfInputKey = "fullName" | "name" | "pronouns" | "statusEmoji" | "statusText" | "title";

export function selfInputSeed(
  viewedId: UserId,
  me: User | undefined,
): Partial<Record<SelfInputKey, string>> {
  if (me?.id !== viewedId) return {};
  return {
    fullName: me.realName ?? me.name,
    name: me.name,
    pronouns: me.pronouns ?? "",
    statusEmoji: me.statusEmoji ?? "",
    statusText: me.statusText ?? "",
    title: me.title ?? "",
  };
}
