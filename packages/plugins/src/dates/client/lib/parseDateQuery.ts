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
const DAY_ALIASES = new Map([
  ["today", 0],
  ["tmr", 1],
  ["tom", 1],
  ["tomorrow", 1],
  ["yesterday", -1],
]);
const TIME_WORDS = new Map([
  ["midnight", 0],
  ["noon", 720],
]);
const OFFSET_RE = /^([+-])((?:\d+(?:mo|[mhdwy]))+)$/;
const OFFSET_PART_RE = /(\d+)(mo|[mhdwy])/g;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_DAY_RE = /^([a-z]{3,9})(\d{1,2})$/;
const DAY_MONTH_RE = /^(\d{1,2})([a-z]{3,9})$/;
const TIME_RE = /^(\d{1,2})(?:\.?(\d{2}))?(am|pm)?$/;
const MINUTE_MS = 60000;
const HOUR_MS = 60 * MINUTE_MS;
const DAYS_PER_WEEK = 7;
const MAX_LEAP_GAP_YEARS = 8;

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

function calendarDate(year: number, month: number, day: number): Date | undefined {
  const d = new Date(year, month, day);
  d.setFullYear(year);
  return d.getMonth() === month && d.getDate() === day ? d : undefined;
}

function nameIndex(names: string[], part: string): number {
  return part.length >= 3 ? names.findIndex((name) => name.startsWith(part)) : -1;
}

function monthDay(monthName: string, dayText: string, now: Date): Date | undefined {
  const month = nameIndex(MONTHS, monthName);
  if (month === -1) return;
  const today = startOfDay(0, now);
  for (let year = now.getFullYear(); year <= now.getFullYear() + MAX_LEAP_GAP_YEARS; year++) {
    const d = calendarDate(year, month, Number(dayText));
    if (d && d >= today) return d;
  }
}

function parseDay(part: string, now: Date): Date | undefined {
  const alias = DAY_ALIASES.get(part);
  if (alias !== undefined) return startOfDay(alias, now);
  const weekday = nameIndex(WEEKDAYS, part);
  if (weekday !== -1) return startOfDay(((weekday - now.getDay() + 6) % 7) + 1, now);
  const iso = part.match(ISO_RE);
  if (iso) return calendarDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const named = part.match(MONTH_DAY_RE);
  if (named) return monthDay(named[1] ?? "", named[2] ?? "", now);
  const reversed = part.match(DAY_MONTH_RE);
  if (reversed) return monthDay(reversed[2] ?? "", reversed[1] ?? "", now);
}

function parseTime(part: string): number | undefined {
  const word = TIME_WORDS.get(part);
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

function addMonths(date: Date, months: number) {
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
}

function parseOffset(sign: string, parts: string, now: Date): ParsedDate | undefined {
  const d = new Date(now);
  const direction = sign === "-" ? -1 : 1;
  let hasTime = false;
  for (const [, amount = "0", unit = "m"] of parts.matchAll(OFFSET_PART_RE)) {
    const n = Number(amount) * direction;
    if (unit === "mo") addMonths(d, n);
    else if (unit === "y") addMonths(d, n * 12);
    else if (unit === "d") d.setDate(d.getDate() + n);
    else if (unit === "w") d.setDate(d.getDate() + n * DAYS_PER_WEEK);
    else d.setTime(d.getTime() + n * (unit === "h" ? HOUR_MS : MINUTE_MS));
    hasTime ||= unit === "h" || unit === "m";
  }
  return Number.isFinite(d.getTime()) ? { hasTime, ts: toTs(d) } : undefined;
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

export function parseDateQuery(rawQuery: string, now = new Date()): ParsedDate | undefined {
  const query = rawQuery.toLowerCase();
  if (query === "now") return { hasTime: true, ts: toTs(now) };
  const offset = query.match(OFFSET_RE);
  if (offset) return parseOffset(offset[1] ?? "+", offset[2] ?? "", now);
  const [first = "", second, ...extra] = query.split("_");
  if (extra.length > 0) return;
  const firstDay = parseDay(first, now);
  if (!firstDay) return second === undefined ? parseTimeOnly(first, now) : undefined;
  if (second === undefined) return { hasTime: false, ts: toTs(firstDay) };
  const minutes = parseTime(second);
  if (minutes === undefined) return;
  firstDay.setMinutes(minutes);
  return { hasTime: true, ts: toTs(firstDay) };
}
