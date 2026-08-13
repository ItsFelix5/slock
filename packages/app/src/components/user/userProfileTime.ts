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

export function createLastSeenText(user: Accessor<User | undefined>, now: Accessor<number>) {
  return createMemo(() => {
    const u = user();
    if (!u || u.presence === "active" || !u.lastSeen) return null;
    return formatLastSeen(u.lastSeen, now());
  });
}

export function formatStartDate(value: string | undefined): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!(year && month && day)) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
