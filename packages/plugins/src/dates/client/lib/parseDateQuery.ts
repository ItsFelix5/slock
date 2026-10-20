const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const DAY_ALIASES: Record<string, number> = {
  today: 0,
  tmr: 1,
  tom: 1,
  tomorrow: 1,
  yesterday: -1,
};
const TIME_WORDS: Record<string, number> = { midnight: 0, noon: 720 };
const OFFSET_RE = /^([+-])((?:\d+(?:mo|[mhdwy]))+)$/;
const OFFSET_PART_RE = /(\d+)(mo|[mhdwy])/g;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_DAY_RE = /^([a-z]{3,9})(\d{1,2})$/;
const DAY_MONTH_RE = /^(\d{1,2})([a-z]{3,9})$/;
const TIME_RE = /^(\d{1,2})(?:\.?(\d{2}))?(am|pm)?$/;
const MINUTES_PER_UNIT = { d: 1440, h: 60, m: 1, w: 10080 };

export interface ParsedDate {
  ts: number;
  hasTime: boolean;
}

function startOfDay(offsetDays: number, now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function nameIndex(names: string[], part: string): number {
  return part.length >= 3 ? names.findIndex((name) => name.startsWith(part)) : -1;
}

function monthDay(monthName: string, dayText: string, now: Date): Date | undefined {
  const month = nameIndex(MONTHS, monthName);
  const day = Number(dayText);
  if (month === -1) return;
  const d = new Date(now.getFullYear(), month, day);
  if (d.getDate() !== day) return;
  if (d < startOfDay(0, now)) d.setFullYear(d.getFullYear() + 1);
  return d;
}

function parseDay(part: string, now: Date): Date | undefined {
  const alias = DAY_ALIASES[part];
  if (alias !== undefined) return startOfDay(alias, now);
  const weekday = nameIndex(WEEKDAYS, part);
  if (weekday !== -1) return startOfDay(((weekday - now.getDay() + 6) % 7) + 1, now);
  const iso = part.match(ISO_RE);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const named = part.match(MONTH_DAY_RE);
  if (named) return monthDay(named[1] ?? "", named[2] ?? "", now);
  const reversed = part.match(DAY_MONTH_RE);
  if (reversed) return monthDay(reversed[2] ?? "", reversed[1] ?? "", now);
}

function parseTime(part: string): number | undefined {
  const word = TIME_WORDS[part];
  if (word !== undefined) return word;
  const match = part.match(TIME_RE);
  if (!match) return;
  const [, hourText = "", minuteText = "0", meridiem] = match;
  let hour = Number(hourText);
  const minute = Number(minuteText);
  if (meridiem) {
    if (hour < 1 || hour > 12) return;
    hour = (hour % 12) + (meridiem === "pm" ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return;
  return hour * 60 + minute;
}

function parseOffset(sign: string, parts: string, now: Date): ParsedDate {
  const d = new Date(now);
  const direction = sign === "-" ? -1 : 1;
  let hasTime = false;
  for (const [, amount = "0", unit = "m"] of parts.matchAll(OFFSET_PART_RE)) {
    const n = Number(amount) * direction;
    if (unit === "mo") d.setMonth(d.getMonth() + n);
    else if (unit === "y") d.setFullYear(d.getFullYear() + n);
    else
      d.setTime(d.getTime() + n * MINUTES_PER_UNIT[unit as keyof typeof MINUTES_PER_UNIT] * 60000);
    hasTime ||= unit === "h" || unit === "m";
  }
  return { hasTime, ts: toTs(d) };
}

export function parseDateQuery(query: string, now = new Date()): ParsedDate | undefined {
  if (query === "now") return { hasTime: true, ts: toTs(now) };
  const offset = query.match(OFFSET_RE);
  if (offset) return parseOffset(offset[1] ?? "+", offset[2] ?? "", now);
  const [first = "", second] = query.split("_");
  const firstDay = parseDay(first, now);
  if (!firstDay) return parseTimeOnly(first, now);
  if (second === undefined) return { hasTime: false, ts: toTs(firstDay) };
  const minutes = parseTime(second);
  if (minutes === undefined) return;
  firstDay.setMinutes(minutes);
  return { hasTime: true, ts: toTs(firstDay) };
}

function toTs(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

function parseTimeOnly(part: string, now: Date): ParsedDate | undefined {
  const minutes = parseTime(part);
  if (minutes === undefined) return;
  const target = startOfDay(0, now);
  target.setMinutes(minutes);
  if (target <= now) target.setDate(target.getDate() + 1);
  return { hasTime: true, ts: toTs(target) };
}
