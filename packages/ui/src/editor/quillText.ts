import { BlockEmbed } from "quill/blots/block";
import type Quill from "./quill";

const OBJECT_REPLACEMENT_CHAR = "￼";

export function indexAlignedText(quill: Quill): string {
  return quill
    .getContents()
    .ops.map((op) => {
      if (typeof op.insert === "string") return op.insert;
      const blot = quill.scroll.query(Object.keys(op.insert ?? {})[0] ?? "");
      return typeof blot === "function" && blot.prototype instanceof BlockEmbed
        ? "\n"
        : OBJECT_REPLACEMENT_CHAR;
    })
    .join("");
}

export function asElement(node: Node, blotName: string): HTMLElement {
  if (!(node instanceof HTMLElement))
    throw new Error(`${blotName} blot produced a non-element node`);
  return node;
}
