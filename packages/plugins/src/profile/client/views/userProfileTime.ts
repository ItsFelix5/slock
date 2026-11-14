import { CLOCK_24H } from "@slock/core";
import type { User } from "@slock/types";
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

function tzOffsetMinutes(timeZone: string, atMs: number): number {
  const date = new Date(Math.floor(atMs / 1000) * 1000);
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

export function timeZoneDiffLabel(
  timeZone: string,
  viewerTimeZone: string,
  atMs: number,
): string | null {
  const diff = tzOffsetMinutes(timeZone, atMs) - tzOffsetMinutes(viewerTimeZone, atMs);
  if (diff === 0) return null;
  const hours = Math.floor(Math.abs(diff) / 60);
  const minutes = Math.abs(diff) % 60;
  return `${diff > 0 ? "+" : "-"}${hours}h${minutes ? ` ${minutes}m` : ""}`;
}

export function createTzDiff(user: Accessor<User | undefined>, now: Accessor<number>) {
  return createMemo(() => {
    const tz = user()?.tz;
    if (!tz) return null;
    try {
      return timeZoneDiffLabel(tz, Intl.DateTimeFormat().resolvedOptions().timeZone, now());
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

export function formatStartDate(value: string | undefined): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!(year && month && day)) return null;
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
