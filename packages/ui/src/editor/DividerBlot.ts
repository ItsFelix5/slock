import { BlockEmbed } from "quill/blots/block";
import Quill, { type Range } from "./quill";
import { asElement } from "./quillText";

const DIVIDER_PREFIX = /^--$/;

export default class DividerBlot extends BlockEmbed {
  static blotName = "divider";
  static tagName = "hr";

  static create(value: unknown) {
    const node = asElement(super.create(value), "divider");
    node.contentEditable = "false";
    return node;
  }

  static bindShortcut(editor: Quill) {
    editor.keyboard.addBinding(
      { key: "-" },
      { prefix: DIVIDER_PREFIX, offset: 2 },
      (range: Range) => {
        const at = range.index - 2;
        editor.deleteText(at, 2);
        editor.insertEmbed(at, DividerBlot.blotName, true, "user");
        editor.setSelection(at + 1, 0, "silent");
        return false;
      },
    );
  }
}

Quill.register(DividerBlot);
