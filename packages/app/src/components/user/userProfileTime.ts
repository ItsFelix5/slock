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

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatLastSeen(seenAt: number, now: number): string {
  const diffMs = now - seenAt;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  const dayDiff = Math.round((startOfDay(now) - startOfDay(seenAt)) / day);
  if (dayDiff === 1) {
    const time = new Date(seenAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `yesterday at ${time}`;
  }
  if (dayDiff < 7) return `${dayDiff}d ago`;
  return new Date(seenAt).toLocaleDateString([], { day: "numeric", month: "short" });
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
