export type Crop = { bottom: number; left: number; right: number; top: number };
export type Rect = { height: number; width: number; x: number; y: number };
export type Meme = {
  bottom: string;
  crop: Crop;
  end: number;
  size: number;
  speed: number;
  start: number;
  top: string;
};
export type Timed = { delay: number };

export const MIN_DELAY_MS = 20;
export const MAX_KEPT = 0.9;
const WHITESPACE = /\s+/;
export const SPEEDS = [0.5, 1, 1.5, 2, 3];

export function defaultMeme(frameCount: number): Meme {
  return {
    bottom: "",
    crop: { bottom: 0, left: 0, right: 0, top: 0 },
    end: Math.max(0, frameCount - 1),
    size: 0.12,
    speed: 1,
    start: 0,
    top: "",
  };
}

export function setCrop(crop: Crop, side: keyof Crop, value: number): Crop {
  const opposite = { bottom: "top", left: "right", right: "left", top: "bottom" }[
    side
  ] as keyof Crop;
  const limit = MAX_KEPT - crop[opposite];
  return { ...crop, [side]: Math.max(0, Math.min(value, limit)) };
}

export function cropRect(crop: Crop, width: number, height: number): Rect {
  const x = Math.round(width * crop.left);
  const y = Math.round(height * crop.top);
  return {
    height: Math.max(1, Math.round(height * (1 - crop.bottom)) - y),
    width: Math.max(1, Math.round(width * (1 - crop.right)) - x),
    x,
    y,
  };
}

export function setTrim(meme: Meme, edge: "end" | "start", value: number, last: number): Meme {
  const index = Math.max(0, Math.min(Math.round(value), last));
  return edge === "start"
    ? { ...meme, end: Math.max(meme.end, index), start: index }
    : { ...meme, end: index, start: Math.min(meme.start, index) };
}

export function selectedFrames<T extends Timed>(
  frames: T[],
  meme: Meme,
): { delay: number; frame: T }[] {
  return frames.slice(meme.start, meme.end + 1).map((frame) => ({
    delay: Math.max(MIN_DELAY_MS, Math.round(frame.delay / meme.speed)),
    frame,
  }));
}

export function wrapLines(
  text: string,
  measure: (line: string) => number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(WHITESPACE).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function memeFileName(sourceName: string, animated: boolean): string {
  const dot = sourceName.lastIndexOf(".");
  const base = (dot > 0 ? sourceName.slice(0, dot) : sourceName).trim() || "image";
  return `${base}-meme.${animated ? "gif" : "png"}`;
}
