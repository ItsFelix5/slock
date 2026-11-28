import { applyPalette, GIFEncoder, quantize } from "gifenc";
import type { Decoded } from "./decode";
import { cropRect, type Edits, editedFileName, selectedFrames } from "./edits";
import { drawEdits } from "./render";

const GIF_COLORS = 256;

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

export async function encodeImage(
  decoded: Decoded,
  edits: Edits,
  sourceName: string,
  onProgress?: (fraction: number) => void,
): Promise<File> {
  const frames = selectedFrames(decoded.frames, edits);
  const rect = cropRect(edits.crop, decoded.width, decoded.height);
  const canvas = document.createElement("canvas");
  if (frames.length <= 1) {
    const [only] = frames;
    if (!only) throw new Error("There's nothing to export.");
    drawEdits(canvas, only.frame.image, rect, edits, decoded.jpeg ? "#fff" : undefined);
    const type = decoded.jpeg ? "image/jpeg" : "image/png";
    const name = editedFileName(sourceName, decoded.jpeg ? "jpg" : "png");
    return new File([await canvasBlob(canvas, type)], name, { type });
  }
  const encoder = GIFEncoder();
  for (const [index, { delay, frame }] of frames.entries()) {
    const ctx = drawEdits(canvas, frame.image, rect, edits, "#fff");
    const { data } = ctx.getImageData(0, 0, rect.width, rect.height);
    const palette = quantize(data, GIF_COLORS);
    encoder.writeFrame(applyPalette(data, palette), rect.width, rect.height, { delay, palette });
    onProgress?.((index + 1) / frames.length);
    await yieldToUi();
  }
  encoder.finish();
  return new File([encoder.bytes() as BlobPart], editedFileName(sourceName, "gif"), {
    type: "image/gif",
  });
}
