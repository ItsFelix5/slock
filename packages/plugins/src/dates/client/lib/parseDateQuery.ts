const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_ALIASES: Record<string, number> = {
  today: 0,
  tmr: 1,
  tom: 1,
  tomorrow: 1,
  yesterday: -1,
};
const OFFSET_RE = /^\+(\d+)([mhdw])$/;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
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

function parseDay(part: string, now: Date): Date | undefined {
  const alias = DAY_ALIASES[part];
  if (alias !== undefined) return startOfDay(alias, now);
  const weekday = WEEKDAYS.indexOf(part.slice(0, 3));
  if (weekday !== -1 && "sunday monday tuesday wednesday thursday friday saturday".includes(part))
    return startOfDay(((weekday - now.getDay() + 6) % 7) + 1, now);
  const iso = part.match(ISO_RE);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
}

function parseTime(part: string): number | undefined {
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

export function parseDateQuery(query: string, now = new Date()): ParsedDate | undefined {
  const offset = query.match(OFFSET_RE);
  if (offset) {
    const minutes =
      Number(offset[1]) * MINUTES_PER_UNIT[offset[2] as keyof typeof MINUTES_PER_UNIT];
    const hasTime = offset[2] === "h" || offset[2] === "m";
    return {
      hasTime,
      ts: Math.floor((now.getTime() + minutes * 60000) / 1000),
    };
  }
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
