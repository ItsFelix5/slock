import { getEmbedBlot } from "@slock/ui/editor/quillText";
import Quill from "quill";

export interface CanvasControlValue {
  id: string;
  label: string;
}

export class CanvasControlBlot extends getEmbedBlot() {
  static blotName = "canvasControl";
  static className = "canvas-control";
  static tagName = "span";

  static create(value: CanvasControlValue) {
    // biome-ignore lint/complexity/noThisInStatic: parent embed class is resolved at runtime
    const node = super.create(value);
    if (!(node instanceof HTMLElement))
      throw new Error("canvasControl blot produced a non-element node");
    node.className = "canvas-control bk-mention bk-mention-link";
    node.dataset.id = value.id;
    node.dataset.label = value.label;
    node.textContent = value.label;
    return node;
  }

  static value(node: HTMLElement): CanvasControlValue | undefined {
    const { id, label } = node.dataset;
    return id ? { id, label: label ?? "" } : undefined;
  }
}

Quill.register(CanvasControlBlot);
