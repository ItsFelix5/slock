import { defined } from "@slock/core";

export const EMOJI_COLUMNS = 8;

const BUTTON_SIZE = 32;
const GRID_GAP = 2;
const CHUNK_ROWS = 6;
const CHUNK_SIZE = EMOJI_COLUMNS * CHUNK_ROWS;
const OVERSCAN_PX = 120;

export interface EmojiChunk<T> {
  entries: T[];
  height: number;
  startIndex: number;
  top: number;
}

function rowsHeight(count: number): number {
  const rows = Math.ceil(count / EMOJI_COLUMNS);
  return rows * BUTTON_SIZE + Math.max(0, rows - 1) * GRID_GAP;
}

export function layoutChunks<T>(entries: T[]): { chunks: EmojiChunk<T>[]; totalHeight: number } {
  const chunks: EmojiChunk<T>[] = [];
  let top = 0;
  for (let startIndex = 0; startIndex < entries.length; startIndex += CHUNK_SIZE) {
    const slice = entries.slice(startIndex, startIndex + CHUNK_SIZE);
    const height = rowsHeight(slice.length);
    chunks.push({ entries: slice, height, startIndex, top });
    top += height;
  }
  return { chunks, totalHeight: top };
}

export function visibleChunks<T>(
  layout: { chunks: EmojiChunk<T>[]; totalHeight: number },
  scrollTop: number,
  viewportHeight: number,
) {
  const { chunks, totalHeight } = layout;
  const lo = scrollTop - OVERSCAN_PX;
  const hi = scrollTop + viewportHeight + OVERSCAN_PX;
  let start = 0;
  while (start < chunks.length && defined(chunks[start]).top + defined(chunks[start]).height < lo)
    start++;
  let end = start;
  while (end < chunks.length && defined(chunks[end]).top < hi) end++;
  const last = chunks[end - 1];
  return {
    bottomSpacer: totalHeight - (last ? last.top + last.height : 0),
    list: chunks.slice(start, end),
    topSpacer: chunks[start]?.top ?? 0,
  };
}

export function scrollTopToReveal(index: number, scrollTop: number, viewportHeight: number) {
  const row = Math.floor(index / EMOJI_COLUMNS);
  const rowTop = row * (BUTTON_SIZE + GRID_GAP) - Math.floor(row / CHUNK_ROWS) * GRID_GAP;
  const rowBottom = rowTop + BUTTON_SIZE;
  if (rowTop < scrollTop) return rowTop;
  if (rowBottom > scrollTop + viewportHeight) return rowBottom - viewportHeight;
  return scrollTop;
}
