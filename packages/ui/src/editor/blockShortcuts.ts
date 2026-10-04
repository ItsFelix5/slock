import type Quill from "quill";
import type { Range } from "quill";

export type LinePrefixFormat = {
  prefix: RegExp;
  length: number;
  format: string;
  value: string | number | boolean;
};

export function bindLinePrefix(editor: Quill, { prefix, length, format, value }: LinePrefixFormat) {
  editor.keyboard.addBinding({ key: " " }, { prefix, offset: length }, (range: Range) => {
    editor.deleteText(range.index - length, length);
    editor.formatLine(range.index - length, 1, format, value);
    return false;
  });
}
