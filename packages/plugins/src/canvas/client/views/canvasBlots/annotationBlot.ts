import { asElement } from "@slock/ui/editor/quillText";
import InlineBlot from "quill/blots/inline";
import { ANNOTATION_ATTRIBUTE } from "./formats";

export default class AnnotationBlot extends InlineBlot {
  static override blotName = ANNOTATION_ATTRIBUTE;
  static override className = "canvas-annotation";
  static override tagName = "span";

  static override create(value: string) {
    const node = asElement(super.create(value), "annotation");
    node.dataset.annotation = value;
    return node;
  }

  static override formats(node: HTMLElement) {
    return node.dataset.annotation;
  }
}
