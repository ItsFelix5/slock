import type Keyboard from "quill/modules/keyboard";
import type { Context } from "quill/modules/keyboard";
import Quill, { Parchment, type Range } from "./quill";

const COUNTER = "list-0";
const LIST_PREFIX = /^\s*?(\d+\.|-|\*)$/;

class ListOffsetAttributor extends Parchment.StyleAttributor {
  add(node: HTMLElement, value: string | number) {
    return super.add(node, `${COUNTER} ${Number(value)}`);
  }

  value(node: HTMLElement) {
    return super.value(node).split(" ")[1] ?? "";
  }
}

Quill.register(
  new ListOffsetAttributor("listOffset", "counter-set", { scope: Parchment.Scope.BLOCK }),
);

export const listAutofillBinding = {
  key: " ",
  collapsed: true,
  format: { "code-block": false, blockquote: false, table: false },
  prefix: LIST_PREFIX,
  handler(this: Keyboard, range: Range, context: Context) {
    const [, offset] = this.quill.getLine(range.index);
    if (offset > context.prefix.length) return true;
    const lineStart = range.index - offset;
    const marker = context.prefix.trim();
    const ordered = marker.endsWith(".");
    this.quill.deleteText(lineStart, context.prefix.length, "user");
    this.quill.formatLine(lineStart, 1, "list", ordered ? "ordered" : "bullet", "user");
    const start = Number.parseInt(marker, 10);
    if (ordered && start > 1) this.quill.formatLine(lineStart, 1, "listOffset", start - 1, "user");
    return false;
  },
};

export function wireListOffsetCleanup(quill: Quill) {
  quill.on("text-change", (_delta, _old, source) => {
    if (source !== "user") return;
    for (const line of quill.getLines()) {
      const index = quill.getIndex(line);
      const { list, listOffset } = quill.getFormat(index, 1);
      if (listOffset && !list) quill.formatLine(index, 1, "listOffset", false, "api");
    }
  });
}
