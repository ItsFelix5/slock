import type { Message } from "@slock/slack-api";

// Used only to guess the height of a message the virtualized MessageRows
// hasn't mounted (and therefore can't measure) yet — real, measured heights
// (see MessageRows.tsx's ResizeObserver) always win once a row renders. This
// just needs to be close enough that scrolling through unmeasured history
// doesn't produce a big visible jump, not pixel-perfect.
const LINE_HEIGHT = 21;
const BASE_ROW_HEIGHT = 26;
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
  containerWidth = DEFAULT_CONTAINER_WIDTH,
): number {
  const wrapWidth = Math.max(120, containerWidth - GUTTER_WIDTH);
  const lines = estimateLineCount(message.text ?? "", wrapWidth);
  let height = BASE_ROW_HEIGHT + lines * LINE_HEIGHT;
  if (message.files?.length) height += 180;
  if (message.attachments?.length) height += 90 * message.attachments.length;
  if (message.reactions?.length) height += 28;
  if (message.replyCount) height += 34;
  return height;
}
