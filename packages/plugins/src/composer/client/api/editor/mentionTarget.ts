import { isChannelId, isUserId } from "@slock/slack";
import type { ChannelId, UserId } from "@slock/types";

export type MentionTarget =
  | { kind: "user" | "userlink"; id: UserId }
  | { kind: "channel"; id: ChannelId }
  | { kind: "usergroup" | "messagelink"; id: string };

function targetOf(kind: string | undefined, id: string): MentionTarget | undefined {
  if (kind === "user" || kind === "userlink") return isUserId(id) ? { id, kind } : undefined;
  if (kind === "channel") return isChannelId(id) ? { id, kind } : undefined;
  return kind === "usergroup" || kind === "messagelink" ? { id, kind } : undefined;
}

export function mentionTarget(
  kind: string | undefined,
  id: string | undefined,
): MentionTarget | undefined {
  return id ? targetOf(kind, id) : undefined;
}
