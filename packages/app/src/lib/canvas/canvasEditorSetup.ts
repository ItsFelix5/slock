import Quill, { type Range } from "quill";
import { SECTION_ID_ATTRIBUTE } from "../../components/channel/canvasBlots";
import type { IdFix } from "./canvasLines";

const Delta = Quill.import("delta");
const EMPTY_SUFFIX_RE = /^$/;

export function applyIdFixes(quill: Quill, fixes: IdFix[]) {
  for (const { id, index } of fixes) quill.formatLine(index, 1, SECTION_ID_ATTRIBUTE, id, "silent");
}

type Handler = (range: Range, context: { format: Record<string, unknown> }) => boolean | undefined;

function bindFirst(
  quill: Quill,
  binding: {
    collapsed?: boolean;
    format?: string[];
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
}
