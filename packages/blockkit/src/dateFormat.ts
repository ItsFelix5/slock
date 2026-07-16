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

function dateNum(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function dateFull(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${ordinal(date.getDate())}, ${date.getFullYear()}`;
}
function dateShort(date: Date): string {
  return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
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

const TOKEN_FORMATTERS: Record<string, (date: Date) => string> = {
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
    return new Date(timestamp * 1000).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return fallback ?? "a date";
  }
}

export function formatSlackDateTokens(
  format: string,
  timestamp: number,
  fallback?: string,
): string {
  try {
    const date = new Date(timestamp * 1000);
    return format.replace(TOKEN_RE, (whole, token) => TOKEN_FORMATTERS[token]?.(date) ?? whole);
  } catch {
    return fallback ?? "a date";
  }
}

// Offered by the composer's date picker as the format-choice step, in the
// same order (and with the same fallback text) Slack's own client shows them.
export const DATE_FORMAT_OPTIONS: { format: string; label: string }[] = [
  { format: "{date_num}", label: "Date" },
  { format: "{date}", label: "Date (long)" },
  { format: "{date_short}", label: "Date (short)" },
  { format: "{date_pretty}", label: "Date (relative)" },
  { format: "{time}", label: "Time" },
  { format: "{date_short_pretty} at {time}", label: "Date and time" },
  { format: "{date_long_pretty} at {time_secs}", label: "Date and time (long)" },
];
