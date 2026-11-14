import Quill, { getEmbedBlot } from "@slock/ui/editor/quill";
import { asElement } from "@slock/ui/editor/quillText";

export class SoftBreakBlot extends getEmbedBlot() {
  static blotName = "softbreak";
  static tagName = "span";
  static className = "canvas-softbreak";

  static create(value: boolean) {
    return asElement(super.create(value), "softbreak");
  }

  static value() {
    return true;
  }
}

Quill.register(SoftBreakBlot);
