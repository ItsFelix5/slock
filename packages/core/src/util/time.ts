export const CLOCK_24H = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;

const pad = (value: number) => String(value).padStart(2, "0");

export function formatTimeFromMs(ms: number) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "Invalid Date";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatTime(ts: string) {
  return formatTimeFromMs(parseFloat(ts) * 1000);
}

function perTimezone<T>(create: () => T): (atMs: number) => T {
  let zone: string | undefined;
  let value: T;
  return (atMs) => {
    const current = `${Intl.DateTimeFormat().resolvedOptions().timeZone}${new Date(atMs).getTimezoneOffset()}`;
    if (zone !== current) {
      zone = current;
      value = create();
    }
    return value;
  };
}

const dayFormat = perTimezone(
  () => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", weekday: "long" }),
);
const dayWithYearFormat = perTimezone(
  () =>
    new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "long",
      weekday: "long",
      year: "numeric",
    }),
);

const monthDayFormat = perTimezone(
  () => new Intl.DateTimeFormat([], { day: "numeric", month: "short" }),
);

export const formatMonthDayFromMs = (ms: number) => monthDayFormat(ms).format(ms);

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function formatDayFromMs(ms: number, now: number) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "Invalid Date";
  const today = new Date(now);
  if (sameDay(date, today)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, yesterday)) return "Yesterday";
  const format = date.getFullYear() === today.getFullYear() ? dayFormat : dayWithYearFormat;
  return format(ms).format(date);
}

export function formatDay(ts: string, now: number) {
  return formatDayFromMs(parseFloat(ts) * 1000, now);
}
