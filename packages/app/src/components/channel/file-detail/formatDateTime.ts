import { CLOCK_24H } from "@slock/types";

export function formatDateTime(value: number | string | undefined): string {
  const seconds = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!seconds) return "";
  return new Date(seconds * 1000).toLocaleString(undefined, {
    ...CLOCK_24H,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
