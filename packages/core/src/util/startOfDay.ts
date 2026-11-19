export function startOfDay(value: number, offsetDays?: number): number;
export function startOfDay(value: Date, offsetDays?: number): Date;
export function startOfDay(value: number | Date, offsetDays = 0): number | Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return typeof value === "number" ? date.getTime() : date;
}
