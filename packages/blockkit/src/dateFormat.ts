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

function relativeDayLabel(date: Date): string | undefined {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
}

function includesYear(date: Date): boolean {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return day < start || day > end;
}

function dateNum(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function dateFull(date: Date): string {
  const value = `${MONTH_NAMES[date.getMonth()]} ${ordinal(date.getDate())}`;
  return includesYear(date) ? `${value}, ${date.getFullYear()}` : value;
}
function dateShort(date: Date): string {
  const value = `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
  return includesYear(date) ? `${value}, ${date.getFullYear()}` : value;
}
function dateLong(date: Date): string {
  return `${WEEKDAY_NAMES[date.getDay()]}, ${dateFull(date)}`;
}
function time(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function timeSecs(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}
function ago(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const absoluteSeconds = Math.abs(seconds);
  const [value, unit] =
    absoluteSeconds < 60
      ? [absoluteSeconds, "second"]
      : absoluteSeconds < 3600
        ? [Math.round(absoluteSeconds / 60), "minute"]
        : absoluteSeconds < 86_400
          ? [Math.round(absoluteSeconds / 3600), "hour"]
          : [Math.round(absoluteSeconds / 86_400), "day"];
  const period = `${value} ${unit}${value === 1 ? "" : "s"}`;
  return seconds >= 0 ? `${period} ago` : `in ${period}`;
}

const TOKEN_FORMATTERS: Record<string, (date: Date) => string> = {
  ago,
  date: dateFull,
  date_long: dateLong,
  date_long_pretty: (d) => relativeDayLabel(d) ?? dateLong(d),
  date_num: dateNum,
  date_pretty: (d) => relativeDayLabel(d) ?? dateFull(d),
  date_short: dateShort,
  date_short_pretty: (d) => relativeDayLabel(d) ?? dateShort(d),
  time,
  time_secs: timeSecs,
};

const TOKEN_RE = /\{([a-z_]+)\}/g;

export const DEFAULT_DATE_FORMAT = "{date_short_pretty} at {time}";

export function formatSlackDate(timestamp: number, fallback?: string): string {
  try {
    const value = new Date(timestamp * 1000).toISOString();
    return `${value.slice(0, 10)} ${value.slice(11, 19)} UTC`;
  } catch {
    return fallback ?? "a date";
  }
}

export function formatFullDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString([], {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    second: "2-digit",
    timeZoneName: "short",
    weekday: "long",
    year: "numeric",
  });
}

export function formatFullDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  });
}

export function formatSlackDateTokens(
  format: string,
  timestamp: number,
  fallback?: string,
): string {
  try {
    const date = new Date(timestamp * 1000);
    if (Number.isNaN(date.getTime())) return fallback ?? "a date";
    return format.replace(TOKEN_RE, (whole, token) => TOKEN_FORMATTERS[token]?.(date) ?? whole);
  } catch {
    return fallback ?? "a date";
  }
}

function partsInZone(ms: number, timeZone: string) {
  const map: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(new Date(ms)))
    map[part.type] = part.value;
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

export function zonedDateTimeToMs(
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

export function timeZoneOffsetAtAnchor(anchorMs: number, timeZone?: string): number {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timeZoneOffsetAt(anchorMs, zone);
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

export function relativeDayMs(anchorMs: number, dayOffset: number, timeZone?: string): number {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const anchor = partsInZone(anchorMs, zone);
  return zonedDateTimeToMs(anchor.year, anchor.month, anchor.day + dayOffset, 12, 0, 0, zone);
}

export const DATE_FORMAT_OPTIONS = [
  { format: "{date_num}", label: "Year-month-day" },
  { format: "{date}", label: "Natural" },
  { format: "{date_short}", label: "Abbreviated" },
  { format: "{date_long}", label: "With weekday" },
  { format: "{date_pretty}", label: "Natural, relative" },
  { format: "{date_short_pretty}", label: "Abbreviated, relative" },
  { format: "{date_long_pretty}", label: "With weekday, relative" },
];

export const DATE_FORMAT_OPTION_PAIRS = [
  { normal: DATE_FORMAT_OPTIONS[0] },
  { normal: DATE_FORMAT_OPTIONS[1], relative: DATE_FORMAT_OPTIONS[4] },
  { normal: DATE_FORMAT_OPTIONS[2], relative: DATE_FORMAT_OPTIONS[5] },
  { normal: DATE_FORMAT_OPTIONS[3], relative: DATE_FORMAT_OPTIONS[6] },
];

export const TIME_FORMAT_OPTIONS = [
  { format: "{time}", label: "Hours and minutes" },
  { format: "{time_secs}", label: "Including seconds" },
];

export function formatDuration(seconds: number | undefined): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds ?? 0)) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function startOfDayMs(ts: number): number {
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
    const timeStr = new Date(seenAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    return `yesterday at ${timeStr}`;
  }
  if (dayDiff < 7) return `${dayDiff}d ago`;
  return new Date(seenAt).toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}

export function formatTime(time: number): string {
  return new Date(time).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
