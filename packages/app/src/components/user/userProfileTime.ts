import { formatLastSeen } from "@slock/blockkit";
import type { User } from "@slock/slack-api";
import { type Accessor, createMemo } from "solid-js";

export function createLocalTime(user: Accessor<User | undefined>, now: Accessor<number>) {
  return createMemo(() => {
    const tz = user()?.tz;
    if (!tz) return null;
    try {
      return new Date(now()).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        timeZone: tz,
      });
    } catch {
      return null;
    }
  });
}

// Best-effort: only known once we've seen a presence_change for the user
// (see the server's presence/lastSeen.ts), so this is often unset.
export function createLastSeenText(user: Accessor<User | undefined>, now: Accessor<number>) {
  return createMemo(() => {
    const u = user();
    if (!u || u.presence === "active" || !u.lastSeen) return null;
    return formatLastSeen(u.lastSeen, now());
  });
}
