import Quill, { type Range } from "quill";
import { LAYOUT_ATTRIBUTE, SECTION_ID_ATTRIBUTE } from "../../components/channel/canvasBlots";
import type { IdFix } from "./canvasLines";

const Delta = Quill.import("delta");
const EMPTY_SUFFIX_RE = /^$/;

export function applyIdFixes(find: (scope: string) => Quill | undefined, fixes: IdFix[]) {
  for (const { id, index, scope } of fixes)
    find(scope)?.formatLine(index, 1, SECTION_ID_ATTRIBUTE, id, "silent");
}

type Handler = (range: Range, context: { format: Record<string, unknown> }) => boolean | undefined;

export function bindFirst(
  quill: Quill,
  binding: {
    collapsed?: boolean;
    empty?: boolean;
    format?: string[];
    offset?: number;
    key: string;
    shiftKey?: boolean;
    suffix?: RegExp;
  },
  handler: Handler,
) {
  quill.keyboard.addBinding(binding, handler);
  const list = quill.keyboard.bindings[binding.key];
  const added = list?.pop();
  if (list && added) list.unshift(added);
}

export function bindCanvasKeys(quill: Quill) {
  bindFirst(quill, { format: ["list"], key: "Tab" }, () => {
    quill.format("indent", "+1", "user");
    return false;
  });
  bindFirst(quill, { format: ["list"], key: "Tab", shiftKey: true }, () => {
    quill.format("indent", "-1", "user");
    return false;
  });
  bindFirst(
    quill,
    { collapsed: true, format: ["header"], key: "Enter", suffix: EMPTY_SUFFIX_RE },
    (range, context) => {
      const [line, offset] = quill.getLine(range.index);
      if (!line) return true;
      const delta = new Delta()
        .retain(range.index)
        .insert("\n", context.format)
        .retain(line.length() - offset - 1)
        .retain(1, { header: null });
      quill.updateContents(delta, "user");
      quill.setSelection(range.index + 1, 0, "silent");
      quill.scrollSelectionIntoView();
      return false;
    },
  );
  bindFirst(
    quill,
    { collapsed: true, empty: true, format: [LAYOUT_ATTRIBUTE], key: "Enter" },
    (range, context) => {
      if (context.format.list) return true;
      quill.formatLine(range.index, 1, LAYOUT_ATTRIBUTE, false, "user");
      return false;
    },
  );
  bindFirst(
    quill,
    { collapsed: true, format: [LAYOUT_ATTRIBUTE], key: "Backspace", offset: 0 },
    (range, context) => {
      if (context.format.list || context.format.header || context.format["code-block"]) return true;
      quill.formatLine(range.index, 1, LAYOUT_ATTRIBUTE, false, "user");
      return false;
    },
  );
}
