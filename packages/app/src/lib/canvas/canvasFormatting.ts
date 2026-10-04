import type Quill from "quill";

export type InlineFormat = "bold" | "code" | "italic" | "strike" | "underline";

const BLOCK_FORMATS = ["header", "list", "code-block", "blockquote", "indent"];

export function currentFormats(quill: Quill): Record<string, unknown> {
  return quill.getSelection() ? quill.getFormat() : {};
}

export function toggleInline(quill: Quill, format: InlineFormat) {
  quill.format(format, !quill.getFormat()[format], "user");
}

export function toggleBlock(
  quill: Quill,
  format: "blockquote" | "code-block" | "header" | "list",
  value: unknown,
) {
  const current = quill.getFormat()[format];
  quill.format(format, current === value ? false : value, "user");
}

export function setParagraph(quill: Quill) {
  const range = quill.getSelection();
  if (!range) return;
  for (const format of BLOCK_FORMATS)
    quill.formatLine(range.index, range.length, format, false, "user");
}

export function shiftIndent(quill: Quill, delta: 1 | -1) {
  if (quill.getFormat().list) quill.format("indent", delta > 0 ? "+1" : "-1", "user");
}

export function insertDivider(quill: Quill) {
  const range = quill.getSelection(true);
  const [line] = quill.getLine(range.index);
  if (!line) return;
  const start = quill.getIndex(line);
  const at = line.length() === 1 ? start : start + line.length();
  quill.insertEmbed(at, "divider", true, "user");
  const [after] = quill.getLine(at + 1);
  if (!after || after.statics.blotName === "divider") quill.insertText(at + 1, "\n", "user");
  quill.setSelection(at + 1, 0, "user");
}

export function undo(quill: Quill) {
  quill.history.undo();
}

export function redo(quill: Quill) {
  quill.history.redo();
}
