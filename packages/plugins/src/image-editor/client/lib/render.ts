import { type Edits, type Rect, wrapLines } from "./edits";

const MAX_LINES = 3;
const MIN_FONT_PX = 10;
const SHRINK = 0.9;

function caption(
  ctx: CanvasRenderingContext2D,
  text: string,
  { height, width }: Rect,
  edge: "bottom" | "top",
  size: number,
) {
  const upper = text.trim().toUpperCase();
  if (!upper) return;
  const pad = width * 0.04;
  let px = Math.max(MIN_FONT_PX, Math.round(height * size));
  let lines: string[] = [];
  for (;;) {
    ctx.font = `900 ${px}px Impact, "Arial Black", sans-serif`;
    lines = wrapLines(upper, (line) => ctx.measureText(line).width, width - 2 * pad);
    const fits =
      lines.length <= MAX_LINES &&
      lines.every((line) => ctx.measureText(line).width <= width - 2 * pad);
    if (fits || px <= MIN_FONT_PX) break;
    px = Math.max(MIN_FONT_PX, Math.floor(px * SHRINK));
  }
  const lineHeight = px * 1.1;
  const top = edge === "top" ? pad : height - pad - lines.length * lineHeight;
  ctx.lineJoin = "round";
  ctx.lineWidth = px / 6;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    const y = top + index * lineHeight;
    ctx.strokeText(line, width / 2, y);
    ctx.fillText(line, width / 2, y);
  });
}

export function drawEdits(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  rect: Rect,
  edits: Edits,
  background?: string,
) {
  if (canvas.width !== rect.width) canvas.width = rect.width;
  if (canvas.height !== rect.height) canvas.height = rect.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas isn't available.");
  ctx.clearRect(0, 0, rect.width, rect.height);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, rect.width, rect.height);
  }
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  caption(ctx, edits.top, rect, "top", edits.size);
  caption(ctx, edits.bottom, rect, "bottom", edits.size);
  return ctx;
}
