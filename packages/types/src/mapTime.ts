export function formatTimeFromMs(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatTime(ts: string) {
  return formatTimeFromMs(parseFloat(ts) * 1000);
}

export function formatDayFromMs(ms: number) {
  const date = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export function formatDay(ts: string) {
  return formatDayFromMs(parseFloat(ts) * 1000);
}
