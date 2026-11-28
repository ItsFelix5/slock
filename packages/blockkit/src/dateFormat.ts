import {
  CLOCK_24H,
  defined,
  formatMonthDayFromMs,
  formatTimeFromMs,
  startOfDay,
} from "@slock/core";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function relativeDayLabel(date: Date, nowMs: number): string | undefined {
  const diffDays = Math.round((startOfDay(date.getTime()) - startOfDay(nowMs)) / 86_400_000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  return diffDays === -1 ? "yesterday" : undefined;
}

function includesYear(date: Date, nowMs: number): boolean {
  const now = new Date(nowMs);
  const start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return day < start || day > end;
}

function dateNum(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function dateFull(date: Date, now: number): string {
  const value = `${MONTH_NAMES[date.getMonth()]} ${ordinal(date.getDate())}`;
  return includesYear(date, now) ? `${value}, ${date.getFullYear()}` : value;
}
function dateShort(date: Date, now: number): string {
  const value = `${defined(MONTH_NAMES[date.getMonth()]).slice(0, 3)} ${date.getDate()}`;
  return includesYear(date, now) ? `${value}, ${date.getFullYear()}` : value;
}
function dateLong(date: Date, now: number): string {
  return `${WEEKDAY_NAMES[date.getDay()]}, ${dateFull(date, now)}`;
}
function dateSlash(date: Date): string {
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;
}
function time(date: Date): string {
  return formatTimeFromMs(date.getTime());
}
function timeSecs(date: Date): string {
  return `${time(date)}:${pad(date.getSeconds())}`;
}
function ago(date: Date, now: number): string {
  const seconds = Math.round((now - date.getTime()) / 1000);
  const absoluteSeconds = Math.abs(seconds);
  const day = 86_400;
  const month = day * 30;
  const year = day * 365;
  const [value, unit] =
    absoluteSeconds < 60
      ? [absoluteSeconds, "second"]
      : absoluteSeconds < 3600
        ? [Math.round(absoluteSeconds / 60), "minute"]
        : absoluteSeconds < day
          ? [Math.round(absoluteSeconds / 3600), "hour"]
          : absoluteSeconds < month
            ? [Math.round(absoluteSeconds / day), "day"]
            : absoluteSeconds < year
              ? [Math.round(absoluteSeconds / month), "month"]
              : [Math.round(absoluteSeconds / year), "year"];
  const period = `${value} ${unit}${value === 1 ? "" : "s"}`;
  return seconds >= 0 ? `${period} ago` : `in ${period}`;
}

const TOKEN_FORMATTERS: Record<string, (date: Date, now: number) => string> = {
  ago,
  date: dateFull,
  date_long: dateLong,
  date_long_pretty: (d, now) => relativeDayLabel(d, now) ?? dateLong(d, now),
  date_num: dateNum,
  date_pretty: (d, now) => relativeDayLabel(d, now) ?? dateFull(d, now),
  date_short: dateShort,
  date_short_pretty: (d, now) => relativeDayLabel(d, now) ?? dateShort(d, now),
  date_slash: dateSlash,
  date_slash_pretty: (d, now) => relativeDayLabel(d, now) ?? dateSlash(d),
  time,
  time_secs: timeSecs,
};

const TOKEN_RE = /\{([a-z_]+)\}/g;

export function formatSlackDate(timestamp: number, fallback?: string): string {
  try {
    const value = new Date(timestamp * 1000).toISOString();
    return `${value.slice(0, 10)} ${value.slice(11, 19)} UTC`;
  } catch {
    return fallback ?? "a date";
  }
}

function formatFullDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString([], {
    ...CLOCK_24H,
    day: "numeric",
    month: "long",
    second: "2-digit",
    weekday: "long",
    year: "numeric",
  });
}

function formatFullDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  });
}

export function formatHoverDateTime(timestamp: number, now: number, dateOnly?: boolean): string {
  const absolute = dateOnly ? formatFullDate(timestamp) : formatFullDateTime(timestamp);
  return `${absolute} · ${formatSlackDateTokens("{ago}", timestamp, now)}`;
}

export function formatSlackDateTokens(
  format: string,
  timestamp: number,
  now: number,
  fallback?: string,
): string {
  try {
    const date = new Date(timestamp * 1000);
    if (Number.isNaN(date.getTime())) return fallback ?? "a date";
    return format.replace(
      TOKEN_RE,
      (whole, token) => TOKEN_FORMATTERS[token]?.(date, now) ?? whole,
    );
  } catch {
    return fallback ?? "a date";
  }
}

const zoneFormats = new Map<string, Intl.DateTimeFormat>();

function zoneFormat(timeZone: string) {
  let format = zoneFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone,
      year: "numeric",
    });
    zoneFormats.set(timeZone, format);
  }
  return format;
}

function partsInZone(ms: number, timeZone: string) {
  const map: Record<string, string> = {};
  for (const part of zoneFormat(timeZone).formatToParts(new Date(ms))) map[part.type] = part.value;
  return {
    day: Number(map.day),

    hour: map.hour === "24" ? 0 : Number(map.hour),
    minute: Number(map.minute),
    month: Number(map.month),
    second: Number(map.second),
    year: Number(map.year),
  };
}

function timeZoneOffsetAt(ms: number, timeZone: string): number {
  const parts = partsInZone(ms, timeZone);
  return Math.round(
    (Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) -
      ms) /
      60_000,
  );
}

function zonedDateTimeToMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  timeZone?: string,
): number {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  return utcGuess - timeZoneOffsetAt(utcGuess, zone) * 60_000;
}

export function zonedWallTimeToMs(
  anchorMs: number,
  hour: number,
  minute: number,
  timeZone?: string,
): number {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const anchor = partsInZone(anchorMs, zone);
  return zonedDateTimeToMs(anchor.year, anchor.month, anchor.day, hour, minute, 0, zone);
}

function startOfDayMs(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function formatLastSeen(seenAt: number, now: number): string {
  const diffMs = now - seenAt;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  const dayDiff = Math.round((startOfDayMs(now) - startOfDayMs(seenAt)) / day);
  if (dayDiff === 1) {
    return `yesterday at ${formatTimeFromMs(seenAt)}`;
  }
  if (dayDiff < 7) return `${dayDiff}d ago`;
  return formatMonthDayFromMs(seenAt);
}
