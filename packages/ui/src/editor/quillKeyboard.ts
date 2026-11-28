import { INLINE_STYLE_FORMATS } from "./inlineFormats";
import { listAutofillBinding, listIndentBindings } from "./listOffset";
import type Quill from "./quill";
import { getEmbedBlot } from "./quill";

export const BASE_FORMATS = [...INLINE_STYLE_FORMATS, "tag", "link", "mention", "emoji"];
export const EXTENDED_FORMATS = [
  "blockquote",
  "context",
  "header",
  "indent",
  "list",
  "listOffset",
  "code-block",
  "divider",
  "date",
];

const UNFORMAT_ON_BACKSPACE = ["blockquote", "context", "header", "code-block"];

export function quillKeyboardBindings(
  getEditor: () => Quill,
  formats: string[],
  checklists: boolean,
) {
  const has = (name: string) => formats.includes(name);
  const blockFormats = formats.some((name) => EXTENDED_FORMATS.includes(name));
  return {
    bold: false,
    italic: false,
    "list autofill": has("list") && listAutofillBinding(checklists, has("listOffset")),
    ...(has("list") && has("indent") ? listIndentBindings() : {}),
    "embed backspace": {
      key: "Backspace",
      collapsed: true,
      handler(range: { index: number }) {
        const editor = getEditor();
        if (range.index === 0) return true;
        const [leaf, offset] = editor.getLeaf(range.index);
        if (!(leaf instanceof getEmbedBlot()) || offset === 0) return true;
        const text = leaf.contentNode.textContent;
        if (!text) return true;
        const at = leaf.offset(editor.scroll);
        editor.deleteText(at, 1, "user");
        editor.insertText(at, text, "user");
        editor.setSelection(at + text.length, 0, "silent");
        return false;
      },
    },
    ...Object.fromEntries(
      INLINE_STYLE_FORMATS.map((format) => [
        `${format} backspace`,
        {
          key: "Backspace",
          collapsed: true,
          format: [format],
          handler(range: { index: number }) {
            const editor = getEditor();
            if (range.index > 0 && editor.getFormat(range.index - 1, 1)[format]) return true;
            editor.format(format, false, "user");
            return false;
          },
        },
      ]),
    ),
    ...(blockFormats
      ? {
          "header enter": false,
          ...Object.fromEntries(
            UNFORMAT_ON_BACKSPACE.filter(has).map((format) => [
              `${format} backspace`,
              {
                key: "Backspace",
                collapsed: true,
                offset: 0,
                format: [format],
                handler() {
                  getEditor().format(format, false, "user");
                  return false;
                },
              },
            ]),
          ),
        }
      : {}),
  };
}
