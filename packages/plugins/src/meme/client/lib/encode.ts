import { applyPalette, GIFEncoder, quantize } from "gifenc";
import type { Decoded } from "./decode";
import { cropRect, type Meme, memeFileName, selectedFrames } from "./meme";
import { drawMeme } from "./render";

const GIF_COLORS = 256;
const PNG_EXTENSION = /\.png$/;

function canvasBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode image."))),
      type,
      0.92,
    ),
  );
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function encodeMeme(
  decoded: Decoded,
  meme: Meme,
  sourceName: string,
  onProgress?: (fraction: number) => void,
): Promise<File> {
  const frames = selectedFrames(decoded.frames, meme);
  const rect = cropRect(meme.crop, decoded.width, decoded.height);
  const canvas = document.createElement("canvas");
  if (frames.length <= 1) {
    const [only] = frames;
    if (!only) throw new Error("There's nothing to export.");
    drawMeme(canvas, only.frame.image, rect, meme, decoded.jpeg ? "#fff" : undefined);
    const type = decoded.jpeg ? "image/jpeg" : "image/png";
    const name = memeFileName(sourceName, false).replace(
      PNG_EXTENSION,
      decoded.jpeg ? ".jpg" : ".png",
    );
    return new File([await canvasBlob(canvas, type)], name, { type });
  }
  const encoder = GIFEncoder();
  for (const [index, { delay, frame }] of frames.entries()) {
    const ctx = drawMeme(canvas, frame.image, rect, meme, "#fff");
    const { data } = ctx.getImageData(0, 0, rect.width, rect.height);
    const palette = quantize(data, GIF_COLORS);
    encoder.writeFrame(applyPalette(data, palette), rect.width, rect.height, { delay, palette });
    onProgress?.((index + 1) / frames.length);
    await yieldToUi();
  }
  encoder.finish();
  return new File([encoder.bytes() as BlobPart], memeFileName(sourceName, true), {
    type: "image/gif",
  });
}
