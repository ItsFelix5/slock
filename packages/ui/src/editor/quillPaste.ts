import { linkifySelectionPaste } from "./linkAutolink";
import Quill from "./quill";

const Delta = Quill.import("delta");
type Delta = InstanceType<typeof Delta>;

export function stripPastedHeader(_node: Element, delta: Delta) {
  return new Delta(
    delta.ops.map((op) => {
      if (!op.attributes?.header) return op;
      const { header: _header, ...attributes } = op.attributes;
      return { ...op, attributes };
    }),
  );
}

export function pasteCaptureHandler(
  editor: Quill,
  handlers: {
    onPasteFiles?: (files: FileList) => void;
    onPasteText?: (quill: Quill, event: ClipboardEvent) => boolean;
  },
) {
  return (event: ClipboardEvent) => {
    const files = event.clipboardData?.files;
    if (files && files.length > 0 && handlers.onPasteFiles) {
      event.preventDefault();
      event.stopPropagation();
      handlers.onPasteFiles(files);
      return;
    }
    if (handlers.onPasteText?.(editor, event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const text = event.clipboardData?.getData("text/plain");
    if (text && linkifySelectionPaste(editor, text)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
}
