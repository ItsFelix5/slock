import { type CanvasFile, type CanvasImage, mapFile, type RawFile } from "@slock/types";
import { resolveCanvasFile, uploadFilesForEdit } from "../api";
import type { FileEmbedValue, ImageEmbedValue } from "./canvasEmbedValues";

const IMAGE_RETRIES = 6;
const IMAGE_RETRY_MS = 700;
const FULL_WIDTH_WEIGHT = 6;
const PREVIEW_WIDTH = 360;
const SQUARE_THUMBS = [64, 80, 160];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processedFile(id: string): Promise<RawFile> {
  let file = await resolveCanvasFile(id);
  for (let attempt = 0; attempt < IMAGE_RETRIES; attempt++) {
    if (!mapFile(file).isImage || file.original_w) break;
    await wait(IMAGE_RETRY_MS);
    file = await resolveCanvasFile(id);
  }
  return file;
}

function imageNode(file: RawFile, id: string): CanvasImage {
  const width = file.original_w ?? PREVIEW_WIDTH;
  const height = file.original_h ?? PREVIEW_WIDTH;
  const scale = Math.min(1, PREVIEW_WIDTH / width);
  return {
    fileId: file.id,
    frames: [],
    height,
    id,
    kind: "image",
    mimetype: mapFile(file).mimetype ?? "image/png",
    name: file.name ?? "image",
    thumbs: [
      ...SQUARE_THUMBS.map((size) => ({ height: size, name: `thumb_${size}`, width: size })),
      {
        height: Math.max(1, Math.round(height * scale)),
        name: `thumb_${PREVIEW_WIDTH}`,
        width: Math.max(1, Math.round(width * scale)),
      },
    ],
    weight: FULL_WIDTH_WEIGHT,
    width,
  };
}

function fileNode(file: RawFile, id: string): CanvasFile {
  return { fileId: file.id, frames: [], id, kind: "file", permalink: file.permalink ?? "" };
}

export type UploadedBlock =
  | { id: string; name: "canvasFile"; value: FileEmbedValue }
  | { id: string; name: "canvasImage"; value: ImageEmbedValue };

export async function uploadCanvasBlocks(
  files: File[],
  newId: () => string,
): Promise<UploadedBlock[]> {
  const uploaded = await uploadFilesForEdit(files.map((file) => ({ file })));
  const blocks: UploadedBlock[] = [];
  for (const { id: fileId } of uploaded) {
    const file = await processedFile(fileId);
    const id = newId();
    blocks.push(
      mapFile(file).isImage
        ? { id, name: "canvasImage", value: { file, node: imageNode(file, id) } }
        : { id, name: "canvasFile", value: { file, node: fileNode(file, id) } },
    );
  }
  return blocks;
}
