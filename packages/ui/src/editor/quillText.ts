import type Quill from "./quill";

const OBJECT_REPLACEMENT_CHAR = "￼";

export function indexAlignedText(quill: Quill): string {
  return quill
    .getContents()
    .ops.map((op) => (typeof op.insert === "string" ? op.insert : OBJECT_REPLACEMENT_CHAR))
    .join("");
}

export function asElement(node: Node, blotName: string): HTMLElement {
  if (!(node instanceof HTMLElement))
    throw new Error(`${blotName} blot produced a non-element node`);
  return node;
}
