import type { SlackFile } from "@slock/types";

export const BAR_COUNT = 40;

export function resample(raw: number[]): number[] {
  if (raw.length <= BAR_COUNT) return raw;
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const start = Math.floor((i * raw.length) / BAR_COUNT);
    const end = Math.max(start + 1, Math.floor(((i + 1) * raw.length) / BAR_COUNT));
    const chunk = raw.slice(start, end);
    return chunk.reduce((sum, v) => sum + v, 0) / chunk.length;
  });
}

export function downloadName({
  filetype,
  name,
  title,
}: Pick<SlackFile, "filetype" | "name" | "title">): string {
  if (!title) return name;
  if (!filetype || title.toLowerCase().endsWith(`.${filetype.toLowerCase()}`)) return title;
  return `${title}.${filetype}`;
}
