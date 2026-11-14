const MONDAY = 1;
const DAYS_PER_WEEK = 7;
const REMINDER_HOUR = 9;

const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

const inMinutes = (minutes: number) => (now: Date) => toSeconds(now) + minutes * 60;

function atReminderHour(now: Date, daysFromNow: number): number {
  const date = new Date(now);
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(REMINDER_HOUR, 0, 0, 0);
  return toSeconds(date);
}

function nextMonday(now: Date): number {
  const daysUntilMonday = (MONDAY - now.getDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK || DAYS_PER_WEEK;
  return atReminderHour(now, daysUntilMonday);
}

export const REMINDER_OPTIONS: { label: string; dateDue: (now: Date) => number }[] = [
  { dateDue: inMinutes(20), label: "in 20 minutes" },
  { dateDue: inMinutes(60), label: "in 1 hour" },
  { dateDue: inMinutes(180), label: "in 3 hours" },
  { dateDue: (now) => atReminderHour(now, 1), label: "tomorrow" },
  { dateDue: nextMonday, label: "next week" },
];

export function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function nextHourInputValue(now: Date): string {
  const date = new Date(now);
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return toLocalInputValue(date);
}

export function dateDueFromInput(value: string): number | null {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : Math.floor(timestamp / 1000);
}
