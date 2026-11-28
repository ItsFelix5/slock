import { BlockEmbed } from "quill/blots/block";
import type Quill from "./quill";

const OBJECT_REPLACEMENT_CHAR = "￼";

export function indexAlignedText(quill: Quill, start = 0, end = quill.getLength()): string {
  return quill
    .getContents(start, end - start)
    .ops.map((op) => {
      if (typeof op.insert === "string") return op.insert;
      const blot = quill.scroll.query(Object.keys(op.insert ?? {})[0] ?? "");
      return typeof blot === "function" && blot.prototype instanceof BlockEmbed
        ? "\n"
        : OBJECT_REPLACEMENT_CHAR;
    })
    .join("");
}

/** Text of the line holding `end - 1`, padded with newlines so positions match the document. */
export function textBefore(quill: Quill, end: number): string {
  if (end <= 0) return "";
  const [, offset] = quill.getLine(end - 1);
  const start = end - 1 - offset;
  return "\n".repeat(start) + indexAlignedText(quill, start, end);
}

export function asElement(node: Node, blotName: string): HTMLElement {
  if (!(node instanceof HTMLElement))
    throw new Error(`${blotName} blot produced a non-element node`);
  return node;
}
