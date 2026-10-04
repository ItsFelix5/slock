import type Quill from "quill";
import { useShortcut } from "../useShortcut";
import { linkifyBeforeSubmit } from "./linkAutolink";
import { toggleUnicodeFont, type UnicodeFontKey } from "./unicodeFonts";

const CONTINUED_BLOCK_FORMATS = ["blockquote", "context", "header", "list", "code-block"];
const RESET_ON_NEWLINE_FORMATS = ["header", "context"];

function insertNewline(quill: Quill, extendedFormats: boolean) {
  const range = quill.getSelection();
  if (!range) return;
  const [, offset] = quill.getLine(range.index);
  if (
    extendedFormats &&
    range.length === 0 &&
    quill.getText(range.index - offset, offset) === "```"
  ) {
    const at = range.index - 3;
    quill.deleteText(at, 3);
    quill.formatLine(at, 1, "code-block", true, "user");
    quill.setSelection(at, 0, "silent");
    return;
  }
  const format = Object.fromEntries(
    Object.entries(quill.getFormat(range)).filter(([name]) =>
      CONTINUED_BLOCK_FORMATS.includes(name),
    ),
  );
  quill.deleteText(range.index, range.length, "user");
  quill.insertText(range.index, "\n", format, "user");
  for (const name of RESET_ON_NEWLINE_FORMATS) {
    if (name in format) quill.formatLine(range.index + 1, 1, name, false, "user");
  }
  quill.setSelection(range.index + 1, 0, "silent");
}

export function useEditorShortcuts(
  getQuill: () => Quill | undefined,
  options: { extendedFormats: boolean; onSubmit: () => (() => void) | undefined },
) {
  const focused = () => getQuill()?.hasFocus() ?? false;
  const format = (name: "bold" | "code" | "italic" | "strike") => () => {
    const quill = getQuill();
    if (!quill) return;
    quill.format(name, !quill.getFormat()[name], "user");
    quill.root.classList.toggle("ql-blank", quill.editor.isBlank());
  };
  const unicodeFont = (font: UnicodeFontKey) => () => {
    const quill = getQuill();
    if (!quill) return;
    const range = quill.getSelection();
    if (!range || range.length === 0) return;
    const styled = toggleUnicodeFont(quill.getText(range.index, range.length), font);
    const formats = quill.getFormat(range);
    quill.deleteText(range.index, range.length, "user");
    quill.insertText(range.index, styled, formats, "user");
    quill.setSelection(range.index, styled.length, "silent");
  };
  const shared = { allowInInputs: true, manual: true, scope: "composer" } as const;

  useShortcut({
    ...shared,
    combo: { key: "Enter" },
    enabled: () => focused() && !!options.onSubmit(),
    handler: () => {
      const quill = getQuill();
      if (quill) linkifyBeforeSubmit(quill);
      options.onSubmit()?.();
    },
    id: "composer.send",
    group: "Message box",
    label: "Send message",
  });
  useShortcut({
    ...shared,
    combo: { key: "Enter", shift: true },
    enabled: focused,
    handler: () => {
      const quill = getQuill();
      if (quill) insertNewline(quill, options.extendedFormats);
    },
    id: "composer.newline",
    group: "Message box",
    label: "Insert a new line",
  });
  useShortcut({
    ...shared,
    combo: { key: "b", mod: true },
    enabled: focused,
    handler: format("bold"),
    id: "composer.bold",
    group: "Formatting",
    label: "Bold",
  });
  useShortcut({
    ...shared,
    combo: { key: "i", mod: true },
    enabled: focused,
    handler: format("italic"),
    id: "composer.italic",
    group: "Formatting",
    label: "Italic",
  });
  useShortcut({
    ...shared,
    combo: { key: "x", mod: true, shift: true },
    enabled: focused,
    handler: format("strike"),
    id: "composer.strike",
    group: "Formatting",
    label: "Strikethrough",
  });
  useShortcut({
    ...shared,
    combo: { key: "c", mod: true, shift: true },
    enabled: focused,
    handler: format("code"),
    id: "composer.code",
    group: "Formatting",
    label: "Inline code",
  });
  useShortcut({
    ...shared,
    combo: { key: "d", mod: true, shift: true },
    enabled: focused,
    handler: unicodeFont("doubleStruck"),
    id: "composer.doubleStruck",
    group: "Formatting",
    label: "Double-struck",
  });
  useShortcut({
    ...shared,
    combo: { key: "g", mod: true, shift: true },
    enabled: focused,
    handler: unicodeFont("gothic"),
    id: "composer.gothic",
    group: "Formatting",
    label: "Gothic",
  });
  useShortcut({
    ...shared,
    combo: { key: "s", mod: true, shift: true },
    enabled: focused,
    handler: unicodeFont("cursive"),
    id: "composer.cursive",
    group: "Formatting",
    label: "Cursive",
  });
}
