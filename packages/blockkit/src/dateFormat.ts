// biome-ignore-all lint/style/useNamingConvention: Formatter keys are Slack's documented date tokens.
// Renders Slack's `<!date^ts^{format}|fallback>` format-token mini-language —
// used both to display a date node (mrkdwn.tsx) and to preview each format
// option in the composer's date picker before it's inserted, so the two never
// drift out of sync.

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
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
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

// Tooltip text for a rendered date token — spells out the same instant the
// short token label (e.g. "1:00 PM", "3 seconds ago") stands for, unambiguously,
// in the viewer's own timezone.
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

// Same as formatFullDateTime, but for a date-only mention ("yesterday") that
// has no time of day to show.
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
    // Some locales format midnight as "24" rather than "00" in hour12: false mode.
    hour: map.hour === "24" ? 0 : Number(map.hour),
    minute: Number(map.minute),
    month: Number(map.month),
    second: Number(map.second),
    year: Number(map.year),
  };
}

// Resolves a bare wall-clock time (e.g. someone typing "1pm" in a message) to
// the real instant it refers to: hour:minute on whichever calendar day
// `anchorMs` falls on in `timeZone` (the sender's, or the viewer's own when
// unknown, unless the text named one explicitly — "5pm UTC"). Re-derives the
// zone's offset at the guessed instant rather than assuming a fixed one, so
// DST transitions resolve correctly.
export function zonedWallTimeToMs(
  anchorMs: number,
  hour: number,
  minute: number,
  timeZone?: string,
): number {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const anchor = partsInZone(anchorMs, zone);
  const utcGuess = Date.UTC(anchor.year, anchor.month - 1, anchor.day, hour, minute);
  const asIfUtc = partsInZone(utcGuess, zone);
  const offset =
    Date.UTC(asIfUtc.year, asIfUtc.month - 1, asIfUtc.day, asIfUtc.hour, asIfUtc.minute) - utcGuess;
  return utcGuess - offset;
}

// Resolves "the calendar day `dayOffset` days from whichever day `anchorMs`
// falls on, in `timeZone`" (e.g. "yesterday") to an instant on that day —
// noon, arbitrarily, since callers only format this as a date.
export function relativeDayMs(anchorMs: number, dayOffset: number, timeZone?: string): number {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const anchor = partsInZone(anchorMs, zone);
  const utcGuess = Date.UTC(anchor.year, anchor.month - 1, anchor.day + dayOffset, 12, 0);
  const asIfUtc = partsInZone(utcGuess, zone);
  const offset =
    Date.UTC(asIfUtc.year, asIfUtc.month - 1, asIfUtc.day, asIfUtc.hour, asIfUtc.minute) - utcGuess;
  return utcGuess - offset;
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

export const TIME_FORMAT_OPTIONS = [
  { format: "{time}", label: "Hours and minutes" },
  { format: "{time_secs}", label: "Including seconds" },
];
