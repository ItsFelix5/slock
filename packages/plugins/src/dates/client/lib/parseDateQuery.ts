import { startOfDay } from "@slock/core";
import { dateToTs } from "../api/dateFormats";

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
  const today = startOfDay(now);
  const years = Array.from(
    { length: MAX_LEAP_GAP_YEARS + 1 },
    (_, offset) => now.getFullYear() + offset,
  );
  return month === -1
    ? undefined
    : years.map((year) => calendarDate(year, month, Number(dayText))).find((d) => d && d >= today);
}

function parseDay(part: string, now: Date): Date | undefined {
  const alias = DAY_ALIASES.get(part);
  if (alias !== undefined) return startOfDay(now, alias);
  const weekday = nameIndex(WEEKDAYS, part);
  if (weekday !== -1) return startOfDay(now, ((weekday - now.getDay() + 6) % 7) + 1);
  const iso = part.match(ISO_RE);
  if (iso) return calendarDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const named = part.match(MONTH_DAY_RE);
  if (named) return monthDay(named[1] ?? "", named[2] ?? "", now);
  const reversed = part.match(DAY_MONTH_RE);
  return reversed ? monthDay(reversed[2] ?? "", reversed[1] ?? "", now) : undefined;
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
  return Number.isFinite(d.getTime()) ? { hasTime, ts: dateToTs(d) } : undefined;
}

function parseTimeOnly(part: string, now: Date): ParsedDate | undefined {
  const minutes = parseTime(part);
  if (minutes === undefined) return;
  const target = startOfDay(now);
  target.setMinutes(minutes);
  if (target <= now) target.setDate(target.getDate() + 1);
  return { hasTime: true, ts: dateToTs(target) };
}

export function parseDateQuery(rawQuery: string, now: Date): ParsedDate | undefined {
  const query = rawQuery.toLowerCase();
  if (query === "now") return { hasTime: true, ts: dateToTs(now) };
  const offset = query.match(OFFSET_RE);
  if (offset) return parseOffset(offset[1] ?? "+", offset[2] ?? "", now);
  const [first = "", second, ...extra] = query.split("_");
  if (extra.length > 0) return;
  const firstDay = parseDay(first, now);
  if (!firstDay) return second === undefined ? parseTimeOnly(first, now) : undefined;
  if (second === undefined) return { hasTime: false, ts: dateToTs(firstDay) };
  const minutes = parseTime(second);
  if (minutes === undefined) return;
  firstDay.setMinutes(minutes);
  return { hasTime: true, ts: dateToTs(firstDay) };
}
