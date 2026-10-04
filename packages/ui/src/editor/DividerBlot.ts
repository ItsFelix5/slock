import Quill, { type Range } from "quill";
import { BlockEmbed } from "quill/blots/block";

const DIVIDER_PREFIX = /^--$/;

export default class DividerBlot extends BlockEmbed {
  static blotName = "divider";
  static tagName = "hr";

  static create(value: unknown) {
    // biome-ignore lint/complexity/noThisInStatic: parent embed class is resolved at runtime
    const node = super.create(value);
    if (!(node instanceof HTMLElement)) throw new Error("divider blot produced a non-element node");
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
