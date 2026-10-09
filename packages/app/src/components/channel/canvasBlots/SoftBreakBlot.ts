import { getEmbedBlot } from "@slock/ui/editor/quillText";
import Quill from "quill";

export class SoftBreakBlot extends getEmbedBlot() {
  static blotName = "softbreak";
  static tagName = "span";
  static className = "canvas-softbreak";

  static create(value: boolean) {
    // biome-ignore lint/complexity/noThisInStatic: parent embed class is resolved at runtime
    const node = super.create(value);
    if (!(node instanceof HTMLElement))
      throw new Error("softbreak blot produced a non-element node");
    return node;
  }

  static value() {
    return true;
  }
}

Quill.register(SoftBreakBlot);
