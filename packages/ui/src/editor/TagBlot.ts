import Inline from "quill/blots/inline";
import { type TagColor, tagColorClass, tagColorOf } from "../tag/tagColors";

export default class TagBlot extends Inline {
  static override blotName = "tag";
  static override className = "bk-tag";
  static override tagName = "span";

  static override create(color: TagColor) {
    const node = super.create();
    node.classList.add(tagColorClass(color));
    return node;
  }

  static override formats(node: HTMLElement) {
    return tagColorOf(node);
  }
}
