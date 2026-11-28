import type { RawMessage, TeamId } from "@slock/types";
import { isTeamId } from "./ids";

const HIDDEN_SUBTYPES = new Set(["tombstone", "thread_hidden"]);

export function isHiddenSubtype(subtype: string | undefined): boolean {
  return !!subtype && HIDDEN_SUBTYPES.has(subtype);
}

export function botIconOf(m: Pick<RawMessage, "bot_profile" | "icons">): string | undefined {
  const icon =
    m.icons?.image_72 ??
    m.icons?.image_48 ??
    m.icons?.image_36 ??
    m.bot_profile?.icons?.image_72 ??
    m.bot_profile?.icons?.image_48 ??
    m.bot_profile?.icons?.image_36;
  return icon || undefined;
}

export function botTeamIdOf(m: Pick<RawMessage, "bot_profile">): TeamId | undefined {
  const id = m.bot_profile?.team_id;
  return id && isTeamId(id) ? id : undefined;
}

export const RELAY_BOT_ID = "B0BU242DJHM";

export function isRawMessage(value: object): value is RawMessage {
  return "ts" in value && typeof value.ts === "string";
}

export const HISTORY_PAGE_SIZE = "100";

export const FIRST_HISTORY_PAGE_SIZE = "40";
