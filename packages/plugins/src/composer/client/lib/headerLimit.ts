import type Quill from "quill";

export const HEADER_MAX_LENGTH = 150;

export function wireHeaderLimit(quill: Quill) {
  quill.on("text-change", (_delta, _old, source) => {
    if (source !== "user") return;
    const index = quill.getSelection()?.index;
    if (index === undefined) return;
    const [line] = quill.getLine(index);
    if (line?.statics.blotName !== "header") return;
    const overflow = line.length() - 1 - HEADER_MAX_LENGTH;
    if (overflow > 0) quill.deleteText(line.offset() + HEADER_MAX_LENGTH, overflow, "user");
  });
}
