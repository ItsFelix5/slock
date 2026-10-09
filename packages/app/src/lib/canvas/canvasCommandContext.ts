import type Quill from "quill";
import { createSignal } from "solid-js";
import { flashCaughtError } from "../feedback";
import type { CanvasCommandContext } from "./canvasCommands";
import { CANVAS_DATE_FORMAT, dateLabel, dateMs } from "./canvasEmbeds";
import { insertBlock } from "./canvasFormatting";
import { uploadCanvasBlocks } from "./canvasUpload";

const FEEDBACK_KEY = "canvas-insert";

export interface CanvasPicker {
  anchor: HTMLElement;
  annotationId?: string;
  kind: "date" | "react";
  quill: Quill;
}

function pickFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = () => resolve([...(input.files ?? [])]);
    input.click();
  });
}

export function lineElement(quill: Quill): HTMLElement {
  const [line] = quill.getLine(quill.getSelection()?.index ?? 0);
  return line?.domNode instanceof HTMLElement ? line.domNode : quill.root;
}

export function insertDate(quill: Quill, timestamp: number) {
  const ms = dateMs(timestamp);
  const index = quill.getSelection(true)?.index ?? quill.getLength();
  quill.insertEmbed(
    index,
    "date",
    { fallback: dateLabel(ms), format: CANVAS_DATE_FORMAT, ts: Math.floor(ms / 1000) },
    "user",
  );
  quill.insertText(index + 1, " ", "user");
  quill.setSelection(index + 2, 0, "user");
}

export function createCanvasCommandContext(options: {
  annotate: (quill: Quill) => Promise<string | null>;
  newId: () => string;
  onComment: (annotationId: string) => void;
}) {
  const [picker, setPicker] = createSignal<CanvasPicker | null>(null);

  async function uploadFiles(quill: Quill, files: File[]) {
    if (files.length === 0) return;
    const range = quill.getSelection();
    try {
      const blocks = await uploadCanvasBlocks(files, options.newId);
      if (range) quill.setSelection(range.index, 0);
      for (const block of blocks)
        insertBlock(quill, { name: block.name, value: block.value }, block.id);
    } catch (error) {
      flashCaughtError(FEEDBACK_KEY, error, "Couldn't upload the file");
    }
  }

  function contextFor(quill: Quill): CanvasCommandContext {
    const anchor = lineElement(quill);
    return {
      comment: () => void options.annotate(quill).then((id) => id && options.onComment(id)),
      newId: options.newId,
      pickDate: () => setPicker({ anchor, kind: "date", quill }),
      pickFiles: () => void pickFiles().then((files) => uploadFiles(quill, files)),
      react: () =>
        void options
          .annotate(quill)
          .then((id) => id && setPicker({ anchor, annotationId: id, kind: "react", quill })),
    };
  }

  return { close: () => setPicker(null), contextFor, picker };
}
