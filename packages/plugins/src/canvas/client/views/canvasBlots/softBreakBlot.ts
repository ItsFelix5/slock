import Quill, { getEmbedBlot } from "@slock/ui/editor/quill";
import { asElement } from "@slock/ui/editor/quillText";

class SoftBreakBlot extends getEmbedBlot() {
  static override blotName = "softbreak";
  static override tagName = "span";
  static override className = "canvas-softbreak";

  static override create(value: boolean) {
    const node = asElement(super.create(value), "softbreak");
    node.dataset.copy = "\n";
    return node;
  }

  static override value() {
    return true;
  }
}

Quill.register(SoftBreakBlot);
