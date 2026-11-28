import { service } from "@slock/core/solid";
import { uploadFilesForEdit } from "@slock/plugins/slack/client/api";
import { mapFile, parseFileId } from "@slock/slack";
import type { CanvasFile, CanvasImage, FileId, RawFile } from "@slock/types";
import Quill from "@slock/ui/editor/quill";
import { createSignal } from "solid-js";
import { type AtomEmbedValue, IMAGE_EMBED } from "./canvasEmbedValues";
import { insertBlocks } from "./canvasFormatting";
import { refreshCanvasFile, resolveCanvasFile } from "./canvasRequests";

const env = service("env");
const feedback = service("feedback");

const IMAGE_RETRIES = 6;
const IMAGE_RETRY_MS = 700;
const FULL_WIDTH_WEIGHT = 6;
const PREVIEW_WIDTH = 360;
const SQUARE_THUMBS = [64, 80, 160];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => env.setTimeout(resolve, ms));
}

async function processedFile(id: FileId): Promise<RawFile> {
  let file = await resolveCanvasFile(id);
  for (let attempt = 0; attempt < IMAGE_RETRIES; attempt++) {
    if (!mapFile(file).isImage || file.original_w) break;
    await wait(IMAGE_RETRY_MS);
    file = await refreshCanvasFile(id);
  }
  return file;
}

function imageNode(file: RawFile, id: string): CanvasImage {
  const width = file.original_w ?? PREVIEW_WIDTH;
  const height = file.original_h ?? PREVIEW_WIDTH;
  const scale = Math.min(1, PREVIEW_WIDTH / width);
  return {
    fileId: parseFileId(file.id),
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
  return {
    fileId: parseFileId(file.id),
    frames: [],
    id,
    kind: "file",
    permalink: file.permalink ?? "",
  };
}

type UploadedBlock =
  | { id: string; name: "canvasFile"; value: AtomEmbedValue<CanvasFile> }
  | { id: string; name: "canvasImage"; value: AtomEmbedValue<CanvasImage> };

async function uploadCanvasBlocks(
  files: File[],
  newId: () => string,
  onProgress: (done: number) => void,
): Promise<UploadedBlock[]> {
  const uploaded = await uploadFilesForEdit(
    files.map((file) => ({ file })),
    (index, fraction) => onProgress((index + fraction) / files.length),
  );
  const blocks: UploadedBlock[] = [];
  for (const { id: fileId } of uploaded) {
    const file = await processedFile(parseFileId(fileId));
    const id = newId();
    blocks.push(
      mapFile(file).isImage
        ? { id, name: "canvasImage", value: { node: imageNode(file, id) } }
        : { id, name: "canvasFile", value: { node: fileNode(file, id) } },
    );
  }
  return blocks;
}

function followIndex(quill: Quill, start: number) {
  let index = start;
  function move(...[name, delta]: [string, ReturnType<Quill["getContents"]>]) {
    if (name === "text-change") index = delta.transformPosition(index);
  }
  quill.on("editor-change", move);
  return {
    index: () => index,
    stop: () => void quill.off("editor-change", move),
  };
}

export function createCanvasUploads(options: { fileId: FileId; newId: () => string }) {
  const running = new Map<symbol, number>();
  const [progress, setProgress] = createSignal<number>();

  function report(key: symbol, done?: number) {
    if (done === undefined) running.delete(key);
    else running.set(key, done);
    const total = [...running.values()].reduce((sum, value) => sum + value, 0);
    setProgress(running.size > 0 ? total / running.size : undefined);
  }

  async function upload(quill: Quill, files: File[], index?: number) {
    if (files.length === 0 || !quill.isEnabled() || !quill.scroll.query(IMAGE_EMBED)) return;
    const key = Symbol();
    const target = followIndex(quill, index ?? quill.getSelection(true).index);
    report(key, 0);
    try {
      const blocks = await uploadCanvasBlocks(files, options.newId, (done) => report(key, done));
      const from = target.index();
      const { end } = insertBlocks(quill, from, blocks);
      if (quill.getSelection()?.index === from) quill.setSelection(end, 0, "silent");
    } catch (error) {
      feedback.caught(options.fileId, error, "Couldn't upload the file");
    } finally {
      target.stop();
      report(key);
    }
  }

  return { progress, upload };
}

function dropTarget(target: Element) {
  for (
    let container = target.closest(".ql-container");
    container;
    container = container.parentElement?.closest(".ql-container") ?? null
  ) {
    const quill = Quill.find(container);
    if (!(quill instanceof Quill && quill.scroll.query(IMAGE_EMBED))) continue;
    const line = [...quill.root.children].find((child) => child.contains(target));
    const blot = line && Quill.find(line);
    const index = blot && !(blot instanceof Quill) ? quill.getIndex(blot) : quill.getLength() - 1;
    return { index, quill };
  }
  return null;
}

export function bindFileDrops(
  element: HTMLElement,
  fallback: () => Quill | undefined,
  upload: (quill: Quill, files: File[], index: number) => void,
) {
  const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files");
  element.addEventListener("dragover", (event) => {
    if (carriesFiles(event)) event.preventDefault();
  });
  element.addEventListener(
    "drop",
    (event) => {
      if (!(carriesFiles(event) && event.target instanceof Element)) return;
      event.preventDefault();
      event.stopPropagation();
      const root = fallback();
      const found =
        dropTarget(event.target) ?? (root && { index: root.getLength() - 1, quill: root });
      if (found) upload(found.quill, [...(event.dataTransfer?.files ?? [])], found.index);
    },
    true,
  );
}
