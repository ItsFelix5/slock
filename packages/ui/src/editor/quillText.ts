import type Quill from "quill";

const OBJECT_REPLACEMENT_CHAR = "￼";

export function indexAlignedText(quill: Quill): string {
  return quill
    .getContents()
    .ops.map((op) => (typeof op.insert === "string" ? op.insert : OBJECT_REPLACEMENT_CHAR))
    .join("");
}
