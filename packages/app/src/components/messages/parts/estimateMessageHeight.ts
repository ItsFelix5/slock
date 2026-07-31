import type { Message } from "@slock/slack-api";

// Used only to guess the height of a message the virtualized MessageRows
// hasn't mounted (and therefore can't measure) yet — real, measured heights
// (see MessageRows.tsx's ResizeObserver) always win once a row renders. This
// just needs to be close enough that scrolling through unmeasured history
// doesn't produce a big visible jump, not pixel-perfect.
const LINE_HEIGHT = 21;
const ROW_PADDING = 6;
// A message that opens an author group renders a name/timestamp header line
// above its text; grouped follow-ups render just the text. Estimating both the
// same was the biggest source of estimate→measured drift (i.e. scroll jitter).
const GROUP_HEADER_HEIGHT = 22;
const DIVIDER_HEIGHT = 30;
const AVG_CHAR_WIDTH = 7.2;
const GUTTER_WIDTH = 84;
const DEFAULT_CONTAINER_WIDTH = 640;

let measureCtx: CanvasRenderingContext2D | null | undefined;
function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx;
  try {
    measureCtx = document.createElement("canvas").getContext("2d");
    if (measureCtx) measureCtx.font = "15px -apple-system, BlinkMacSystemFont, sans-serif";
  } catch {
    measureCtx = null;
  }
  return measureCtx ?? null;
}

function estimateLineCount(text: string, wrapWidth: number): number {
  if (!text) return 0;
  const ctx = getMeasureContext();
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines += 1;
      continue;
    }
    const width = ctx ? ctx.measureText(paragraph).width : paragraph.length * AVG_CHAR_WIDTH;
    lines += Math.max(1, Math.ceil(width / wrapWidth));
  }
  return lines;
}

export function estimateMessageHeight(
  message: Message,
  prev?: Message,
  containerWidth = DEFAULT_CONTAINER_WIDTH,
): number {
  const wrapWidth = Math.max(120, containerWidth - GUTTER_WIDTH);
  const lines = estimateLineCount(message.text ?? "", wrapWidth);
  let height = ROW_PADDING + Math.max(1, lines) * LINE_HEIGHT;
  // Mirrors MessageRow's grouping/day-divider gating closely enough to keep
  // unmeasured rows near their real height (see sameAuthorAsPrev there).
  const grouped = !!prev && prev.userId === message.userId && prev.day === message.day;
  if (!grouped) height += GROUP_HEADER_HEIGHT;
  if (!prev || prev.day !== message.day) height += DIVIDER_HEIGHT;
  if (message.files?.length) height += 180;
  if (message.attachments?.length) height += 90 * message.attachments.length;
  if (message.reactions?.length) height += 28;
  if (message.replyCount) height += 34;
  return height;
}
