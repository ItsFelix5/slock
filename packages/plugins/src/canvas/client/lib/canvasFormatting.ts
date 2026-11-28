import type { LayoutFrame } from "@slock/types";
import Quill, { type Op } from "@slock/ui/editor/quill";
import { BlockEmbed } from "quill/blots/block";
import { framesFromAttribute, layoutAttribute, withCallout, withQuote } from "../../protocol/api";
import { ANNOTATION_ATTRIBUTE, LAYOUT_ATTRIBUTE } from "../views/canvasBlots";
import {
  COLUMNS_EMBED,
  type ColumnsEmbedValue,
  DIVIDER_EMBED,
  TABLE_EMBED,
  type TableEmbedValue,
} from "./canvasEmbedValues";

const Delta = Quill.import("delta");

const BLOCK_FORMATS = ["header", "list", "code-block", "indent"];
const TABLE_ROWS = 3;
const TABLE_COLUMNS = 2;
const TABLE_COLUMN_WIDTH = 300;
const HEX_LENGTH = 25;

export function toggleBlock(
  quill: Quill,
  format: "code-block" | "header" | "list",
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

function selectedLines(quill: Quill) {
  const range = quill.getSelection(true);
  return range ? quill.getLines(range.index, Math.max(range.length, 1)) : [];
}

function lineFrames(line: ReturnType<Quill["getLine"]>[0]): LayoutFrame[] {
  const node = line?.domNode;
  return framesFromAttribute(node instanceof HTMLElement ? node.dataset.layout : undefined);
}

function updateFrames(quill: Quill, update: (frames: LayoutFrame[]) => LayoutFrame[]) {
  for (const line of selectedLines(quill)) {
    const next = layoutAttribute(update(lineFrames(line))) ?? false;
    quill.formatLine(quill.getIndex(line), 1, LAYOUT_ATTRIBUTE, next, "user");
  }
}

export function toggleQuote(quill: Quill) {
  const lines = selectedLines(quill);
  const quoted =
    lines.length > 0 && lines.every((line) => lineFrames(line).some((f) => f.kind === "quote"));
  updateFrames(quill, (frames) => withQuote(frames, !quoted));
}

export function setCallout(quill: Quill, color: number | null) {
  const lines = selectedLines(quill);
  const same =
    color !== null &&
    lines.length > 0 &&
    lines.every((line) => lineFrames(line).some((f) => f.kind === "callout" && f.color === color));
  updateFrames(quill, (frames) => withCallout(frames, same ? null : color));
}

function commentRange(quill: Quill): { index: number; length: number } | null {
  const range = quill.getSelection(true);
  const [line] = quill.getLine(range.index);
  if (!line) return null;
  const start = quill.getIndex(line);
  const lineEnd = start + line.length() - 1;
  const from = range.length > 0 ? range.index : start;
  const to = range.length > 0 ? Math.min(range.index + range.length, lineEnd) : lineEnd;
  return to > from ? { index: from, length: to - from } : null;
}

// Annotating over an anchor would replace it and strand its thread, so any overlap reuses it.
export function commentAnchorAt(quill: Quill): string | null {
  const range = commentRange(quill);
  if (!range) return null;
  for (const op of quill.getContents(range.index, range.length).ops) {
    const id = op.attributes?.[ANNOTATION_ATTRIBUTE];
    if (typeof id === "string") return id;
  }
  return null;
}

// Comment access disables the editor, which rejects "user" changes.
function annotationSource(quill: Quill) {
  return quill.isEnabled() ? "user" : "api";
}

export function annotateSelection(quill: Quill, id: string): boolean {
  const range = commentRange(quill);
  if (!range) return false;
  quill.formatText(range.index, range.length, ANNOTATION_ATTRIBUTE, id, annotationSource(quill));
  return true;
}

function blockInsertIndex(quill: Quill, index: number): number {
  const [line] = quill.getLine(index);
  if (!line) return index;
  const start = quill.getIndex(line);
  return line.length() === 1 ? start : start + line.length();
}

interface NewBlock {
  id: string;
  name: string;
  value: unknown;
}

export function insertBlocks(quill: Quill, index: number, blocks: NewBlock[]) {
  const at = blockInsertIndex(quill, index);
  const delta = new Delta().retain(at);
  for (const { id, name, value } of blocks) delta.insert({ [name]: value }, { sid: id });
  quill.updateContents(delta, "user");
  const end = at + blocks.length;
  const [after] = quill.getLine(end);
  if (!after || after instanceof BlockEmbed) quill.insertText(end, "\n", "user");
  return { at, end };
}

function insertBlock(quill: Quill, embed: { name: string; value: unknown }, id: string): number {
  const { at, end } = insertBlocks(quill, quill.getSelection(true).index, [{ ...embed, id }]);
  quill.setSelection(end, 0, "user");
  return at;
}

const FOCUS_ATTEMPTS = 20;

function focusFirstNested(quill: Quill, at: number, attempts = FOCUS_ATTEMPTS) {
  requestAnimationFrame(() => {
    const [leaf] = quill.getLeaf(at);
    const root =
      leaf?.domNode instanceof HTMLElement ? leaf.domNode.querySelector(".ql-editor") : null;
    const nested = root?.parentElement ? Quill.find(root.parentElement) : null;
    if (nested instanceof Quill) nested.focus();
    else if (attempts > 0) focusFirstNested(quill, at, attempts - 1);
  });
}

export function insertDivider(quill: Quill, id: string) {
  insertBlock(quill, { name: DIVIDER_EMBED, value: true }, id);
}

function hex(newId: () => string): string {
  return newId().slice(-HEX_LENGTH);
}

export function tableValue(
  newId: () => string,
  size: { columns: number; rows: number },
  cellOps: (row: number, column: number) => Op[] = () => [],
): TableEmbedValue {
  const id = newId();
  return {
    columns: Array.from({ length: size.columns }, () => ({
      id: `col:${hex(newId)}`,
      width: TABLE_COLUMN_WIDTH,
    })),
    id,
    rows: Array.from({ length: size.rows }, (_, row) => ({
      cells: Array.from({ length: size.columns }, (_, column) => ({
        contentId: newId(),
        ops: [...cellOps(row, column), { insert: "\n" }],
      })),
      id: `row:${hex(newId)}`,
    })),
  };
}

export function insertTable(quill: Quill, newId: () => string) {
  const value = tableValue(newId, { columns: TABLE_COLUMNS, rows: TABLE_ROWS });
  focusFirstNested(quill, insertBlock(quill, { name: TABLE_EMBED, value }, value.id));
}

function newColumnsValue(count: number, newId: () => string): ColumnsEmbedValue {
  return {
    columns: Array.from({ length: count }, () => [{ attributes: { sid: newId() }, insert: "\n" }]),
    id: newId(),
    weights: count === 2 ? [3, 3] : Array.from({ length: count }, () => 2),
  };
}

export function insertColumns(quill: Quill, count: number, newId: () => string) {
  const value = newColumnsValue(count, newId);
  focusFirstNested(quill, insertBlock(quill, { name: COLUMNS_EMBED, value }, value.id));
}
