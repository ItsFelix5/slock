import type Quill from "quill";
import type { Op, Range } from "quill";
import { escapeRegExp, WHITESPACE_RE } from "../textHighlight";
import { indexAlignedText } from "./quillText";

export const INLINE_MARKS: [char: string, format: "bold" | "italic" | "strike" | "code"][] = [
  ["*", "bold"],
  ["_", "italic"],
  ["~", "strike"],
  ["`", "code"],
];

const MARK_PATTERNS = INLINE_MARKS.map(([char, format]) => {
  const escaped = escapeRegExp(char);
  return { char, format, pattern: new RegExp(`${escaped}([^${escaped}\\n]+)$`) };
});

function typedCharIndex(ops: Op[], char: string) {
  const [first, second] = ops;
  const index = typeof first?.retain === "number" ? first.retain : 0;
  const inserted = first?.retain === undefined ? first : second;
  if (ops.length > 2 || inserted?.insert !== char) return;
  return index;
}

export function wireMarkdownAutoformat(quill: Quill, blockFormats: boolean) {
  quill.on("text-change", (delta, _old, source) => {
    if (source !== "user") return;
    const typed = delta.ops.find((op) => typeof op.insert === "string")?.insert;
    if (typeof typed !== "string" || typed.length !== 1) return;
    const mark = MARK_PATTERNS.find(({ char }) => char === typed);
    if (!mark) return;
    const at = typedCharIndex(delta.ops, typed);
    if (at === undefined) return;
    const [, offset] = quill.getLine(at);
    const lineStart = at - offset;
    const before = indexAlignedText(quill).slice(lineStart, at);
    const format = quill.getFormat(at);
    if (format.code || format["code-block"]) return;

    if (blockFormats && typed === "`" && before === "``") {
      quill.deleteText(lineStart, 3, "api");
      quill.formatLine(lineStart, 1, "code-block", true, "api");
      quill.setSelection(lineStart, 0, "api");
      return;
    }

    const match = before.match(mark.pattern);
    if (!match) return;
    const start = at - match[0].length;
    const preceding = before[start - lineStart - 1];
    if (preceding !== undefined && !WHITESPACE_RE.test(preceding)) return;
    quill.deleteText(start, match[0].length + 1, "api");
    quill.insertText(start, match[1], mark.format, true, "api");
    quill.setSelection(start + match[1].length, 0, "api");
    quill.format(mark.format, false, "api");
  });
}

const BLOCK_FORMATS = ["blockquote", "context", "header", "list", "code-block"];

export function wireArrowDownExit(quill: Quill) {
  quill.keyboard.addBinding({ key: "ArrowDown", collapsed: true }, (range: Range) => {
    const [line, offset] = quill.getLine(range.index);
    if (!line || offset !== line.length() - 1 || line.next) return true;
    const formats = quill.getFormat(range.index);
    const blocks = BLOCK_FORMATS.filter((name) => formats[name]);
    if (blocks.length > 0) {
      const blockFormats = Object.fromEntries(blocks.map((name) => [name, formats[name]]));
      quill.insertText(range.index, "\n", blockFormats, "user");
      for (const name of blocks) quill.formatLine(range.index + 1, 1, name, false, "user");
      quill.setSelection(range.index + 1, 0, "silent");
      return false;
    }
    const marks = INLINE_MARKS.filter(([, format]) => formats[format]);
    if (marks.length === 0) return true;
    for (const [, format] of marks) quill.format(format, false, "user");
    return false;
  });
}
