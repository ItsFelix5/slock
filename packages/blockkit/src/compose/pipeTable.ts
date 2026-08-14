import type { RichTextSubBlock } from "@slock/slack-api";
import {
  createCodeBlock,
  createTable,
  createTableCell,
  createTableRow,
  createTextRun,
  type Block as DocBlock,
} from "@slock/ui";

const PIPE_TABLE_RE = /^\|.*\|$/;
const PIPE_SEPARATOR_RE = /^\|(\s*:?-+:?\s*\|)+$/;

/** Detects the `docToBlocks`/pipe-syntax table convention (a preformatted block whose text is
 * `| a | b |` rows with a `| --- | --- |` divider) inside a `rich_text_preformatted` sub-block,
 * so it round-trips back into a real table when editing/reloading — see `serialize.ts`'s
 * `tableToPipeText` for the write side of this same convention. */
export function parsePipeTableText(text: string): DocBlock | undefined {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2 || !lines.every((l) => PIPE_TABLE_RE.test(l.trim()))) return;
  const cellsOf = (line: string) =>
    line
      .trim()
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
  const separatorIndex = lines.findIndex((l) => PIPE_SEPARATOR_RE.test(l.trim()));
  const dataLines = lines.filter((_, i) => i !== separatorIndex);
  if (dataLines.length === 0) return;
  return createTable(
    dataLines.map((line) =>
      createTableRow(cellsOf(line).map((c) => createTableCell([createTextRun(c)]))),
    ),
  );
}

export function preformattedToDoc(
  sub: Extract<RichTextSubBlock, { type: "rich_text_preformatted" }>,
): DocBlock {
  const text = sub.elements.map((el) => (el.type === "text" ? el.text : "")).join("");
  return parsePipeTableText(text) ?? createCodeBlock(text);
}
