import type Quill from "quill";
import QuillNamespace from "quill";
import type EmbedBlot from "quill/blots/embed";

const OBJECT_REPLACEMENT_CHAR = "￼";

export function indexAlignedText(quill: Quill): string {
  return quill
    .getContents()
    .ops.map((op) => (typeof op.insert === "string" ? op.insert : OBJECT_REPLACEMENT_CHAR))
    .join("");
}

let embedBlot: typeof EmbedBlot | undefined;

export function getEmbedBlot(): typeof EmbedBlot {
  embedBlot ??= QuillNamespace.import("blots/embed") as typeof EmbedBlot;
  return embedBlot;
}
