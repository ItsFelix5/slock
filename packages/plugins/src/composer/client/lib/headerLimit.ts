import type Quill from "@slock/ui/editor/quill";

export const HEADER_MAX_LENGTH = 150;

const HIGH_SURROGATE_RE = /^[\uD800-\uDBFF]$/;

export function cutHeaderText(text: string): string {
  const cut = text.slice(0, HEADER_MAX_LENGTH);
  return HIGH_SURROGATE_RE.test(cut.slice(-1)) ? cut.slice(0, -1) : cut;
}

export function wireHeaderLimit(quill: Quill) {
  quill.on("text-change", (_delta, _old, source) => {
    if (source !== "user") return;
    const index = quill.getSelection()?.index;
    if (index === undefined) return;
    const [line] = quill.getLine(index);
    if (line?.statics.blotName !== "header") return;
    const lineEnd = line.offset() + line.length() - 1;
    const lastKept = line.offset() + HEADER_MAX_LENGTH - 1;
    const keepsHalfPair = HIGH_SURROGATE_RE.test(quill.getText(lastKept, 1));
    const cut = keepsHalfPair ? lastKept : lastKept + 1;
    if (lineEnd > cut) quill.deleteText(cut, lineEnd - cut, "user");
  });
}
