import Quill, { getEmbedBlot } from "@slock/ui/editor/quill";
import { asElement } from "@slock/ui/editor/quillText";

export class SoftBreakBlot extends getEmbedBlot() {
  static override blotName = "softbreak";
  static override tagName = "span";
  static override className = "canvas-softbreak";

  static override create(value: boolean) {
    return asElement(super.create(value), "softbreak");
  }

  static override value() {
    return true;
  }
}

Quill.register(SoftBreakBlot);
