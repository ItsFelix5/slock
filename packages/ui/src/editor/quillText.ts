import type Quill from "quill";
import EmbedBlot from "quill/blots/embed";

const OBJECT_REPLACEMENT_CHAR = "￼";

export function indexAlignedText(quill: Quill): string {
  return quill
    .getContents()
    .ops.map((op) => (typeof op.insert === "string" ? op.insert : OBJECT_REPLACEMENT_CHAR))
    .join("");
}

export function getEmbedBlot(): typeof EmbedBlot {
  return EmbedBlot;
}
