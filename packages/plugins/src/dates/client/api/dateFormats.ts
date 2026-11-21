export const DATE_PAIRS = [
  { label: "Abbreviated", normal: "{date_short}", relative: "{date_short_pretty}" },
  { label: "Natural", normal: "{date}", relative: "{date_pretty}" },
  { label: "With weekday", normal: "{date_long}", relative: "{date_long_pretty}" },
];

export const TIME_OPTIONS = [
  { format: "{time}", label: "Hours and minutes" },
  { format: "{time_secs}", label: "Including seconds" },
];

export function nextHour(now: number): Date {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

export function dateToTs(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

export function parseFormat(format: string) {
  const parts = format.split(" at ");
  return {
    ago: format === "{ago}",
    date: parts.find((part) => part.startsWith("{date")) ?? "",
    time: parts.find((part) => part.startsWith("{time")) ?? "",
  };
}

export function joinFormat(ago: boolean, date: string, time: string): string {
  return ago ? "{ago}" : [date, time].filter(Boolean).join(" at ");
}
