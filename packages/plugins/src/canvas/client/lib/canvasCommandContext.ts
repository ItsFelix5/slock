import type Quill from "@slock/ui/editor/quill";
import { createSignal } from "solid-js";
import type { CanvasCommandContext } from "./canvasCommands";
import { CANVAS_DATE_FORMAT, dateLabel, dateMs } from "./canvasEmbeds";

export type CanvasPicker = { anchor: HTMLElement; quill: Quill } & (
  | { kind: "date" }
  | { kind: "react"; pick: (name: string) => void }
);

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
  onReact: (annotationId: string, name: string) => void;
  upload: (quill: Quill, files: File[]) => void;
}) {
  const [picker, setPicker] = createSignal<CanvasPicker | null>(null);

  function contextFor(quill: Quill): CanvasCommandContext {
    const anchor = lineElement(quill);
    return {
      comment: () => void options.annotate(quill).then((id) => id && options.onComment(id)),
      newId: options.newId,
      pickDate: () => setPicker({ anchor, kind: "date", quill }),
      pickFiles: () => void pickFiles().then((files) => options.upload(quill, files)),
      react() {
        const { index, length } = quill.getSelection(true);
        async function pick(name: string) {
          quill.setSelection(index, length, "silent");
          const id = await options.annotate(quill);
          if (id) options.onReact(id, name);
        }
        setPicker({ anchor, kind: "react", pick, quill });
      },
    };
  }

  return { close: () => setPicker(null), contextFor, picker };
}
