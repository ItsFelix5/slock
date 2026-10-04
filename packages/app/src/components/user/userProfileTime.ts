import { formatLastSeen } from "@slock/blockkit";
import { CLOCK_24H, type User } from "@slock/types";
import { type Accessor, createMemo } from "solid-js";

export function createLocalTime(user: Accessor<User | undefined>, now: Accessor<number>) {
  return createMemo(() => {
    const tz = user()?.tz;
    if (!tz) return null;
    try {
      return new Date(now()).toLocaleTimeString([], { ...CLOCK_24H, timeZone: tz });
    } catch {
      return null;
    }
  });
}

function tzOffsetMinutes(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return (asUTC - date.getTime()) / 60_000;
}

export function createTzDiff(user: Accessor<User | undefined>, now: Accessor<number>) {
  return createMemo(() => {
    const tz = user()?.tz;
    if (!tz) return null;
    try {
      const date = new Date(now());
      const diffHours = Math.round((tzOffsetMinutes(tz, date) + date.getTimezoneOffset()) / 60);
      if (diffHours === 0) return null;
      return `${diffHours > 0 ? "+" : ""}${diffHours}h`;
    } catch {
      return null;
    }
  });
}

export function createTzSuffix(user: Accessor<User | undefined>, tzDiff: Accessor<string | null>) {
  return createMemo(() => {
    const parts = [user()?.tzLabel, tzDiff()].filter(Boolean);
    return parts.length ? ` (${parts.join(", ")})` : "";
  });
}

export function createLastSeenText(
  user: Accessor<User | undefined>,
  now: Accessor<number>,
  latestMessageTs: Accessor<number | undefined>,
) {
  return createMemo(() => {
    const u = user();
    if (!u || u.isBot || u.presence === "active") return null;
    const seenAt = Math.max(u.lastSeen ?? 0, latestMessageTs() ?? 0);
    if (!seenAt) return null;
    return formatLastSeen(seenAt, now());
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
