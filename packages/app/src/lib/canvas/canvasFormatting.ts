import { framesFromAttribute, layoutAttribute, withCallout, withQuote } from "@slock/canvas";
import type { LayoutFrame } from "@slock/types";
import Quill from "quill";
import { BlockEmbed } from "quill/blots/block";
import { ANNOTATION_ATTRIBUTE, LAYOUT_ATTRIBUTE } from "../../components/channel/canvasBlots";
import {
  COLUMNS_EMBED,
  type ColumnsEmbedValue,
  DIVIDER_EMBED,
  TABLE_EMBED,
  type TableEmbedValue,
} from "./canvasEmbedValues";

const Delta = Quill.import("delta");

export type InlineFormat = "bold" | "code" | "italic" | "strike" | "underline";

const BLOCK_FORMATS = ["header", "list", "code-block", "indent"];
const TABLE_ROWS = 3;
const TABLE_COLUMNS = 2;
const TABLE_COLUMN_WIDTH = 300;
const HEX_LENGTH = 25;

export function currentFormats(quill: Quill): Record<string, unknown> {
  return quill.getSelection() ? quill.getFormat() : {};
}

export function toggleInline(quill: Quill, format: InlineFormat) {
  quill.format(format, !quill.getFormat()[format], "user");
}

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

export function shiftIndent(quill: Quill, delta: 1 | -1) {
  if (quill.getFormat().list) quill.format("indent", delta > 0 ? "+1" : "-1", "user");
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

export function calloutColorAt(formats: Record<string, unknown>): number | null {
  const frame = framesFromAttribute(formats[LAYOUT_ATTRIBUTE]).find((f) => f.kind === "callout");
  return frame?.kind === "callout" ? frame.color : null;
}

export function quoteActive(formats: Record<string, unknown>): boolean {
  return framesFromAttribute(formats[LAYOUT_ATTRIBUTE]).some((frame) => frame.kind === "quote");
}

export function commentAnchorAt(quill: Quill): string | null {
  const range = quill.getSelection();
  if (!range) return null;
  const annotation = quill.getFormat(range.index, range.length).annotation;
  return typeof annotation === "string" ? annotation : null;
}

export function annotateSelection(quill: Quill, id: string): boolean {
  const range = quill.getSelection(true);
  const [line, offset] = quill.getLine(range.index);
  if (!line) return false;
  const start = quill.getIndex(line);
  const lineEnd = start + line.length() - 1;
  const from = range.length > 0 ? range.index : start;
  const to = range.length > 0 ? Math.min(range.index + range.length, lineEnd) : lineEnd;
  if (to <= from || offset < 0) return false;
  quill.formatText(from, to - from, ANNOTATION_ATTRIBUTE, id, "user");
  return true;
}

function blockInsertIndex(quill: Quill): number {
  const range = quill.getSelection(true);
  const [line] = quill.getLine(range.index);
  if (!line) return range.index;
  const start = quill.getIndex(line);
  return line.length() === 1 ? start : start + line.length();
}

export function insertBlock(quill: Quill, embed: { name: string; value: unknown }, id: string) {
  const at = blockInsertIndex(quill);
  quill.updateContents(
    new Delta().retain(at).insert({ [embed.name]: embed.value }, { sid: id }),
    "user",
  );
  const [after] = quill.getLine(at + 1);
  if (!after || after instanceof BlockEmbed) quill.insertText(at + 1, "\n", "user");
  quill.setSelection(at + 1, 0, "user");
}

export function insertDivider(quill: Quill, id: string) {
  insertBlock(quill, { name: DIVIDER_EMBED, value: true }, id);
}

function hex(newId: () => string): string {
  return newId().slice(-HEX_LENGTH);
}

export function newTableValue(newId: () => string): TableEmbedValue {
  const id = newId();
  return {
    columns: Array.from({ length: TABLE_COLUMNS }, () => ({
      id: `col:${hex(newId)}`,
      width: TABLE_COLUMN_WIDTH,
    })),
    id,
    rows: Array.from({ length: TABLE_ROWS }, () => ({
      cells: Array.from({ length: TABLE_COLUMNS }, () => ({
        contentId: newId(),
        ops: [{ insert: "\n" }],
      })),
      id: `w:${hex(newId)}`,
    })),
  };
}

export function insertTable(quill: Quill, newId: () => string) {
  const value = newTableValue(newId);
  insertBlock(quill, { name: TABLE_EMBED, value }, value.id);
}

export function newColumnsValue(count: number, newId: () => string): ColumnsEmbedValue {
  return {
    columns: Array.from({ length: count }, () => [{ attributes: { sid: newId() }, insert: "\n" }]),
    id: newId(),
    weights: count === 2 ? [3, 3] : Array.from({ length: count }, () => 2),
  };
}

export function insertColumns(quill: Quill, count: number, newId: () => string) {
  const value = newColumnsValue(count, newId);
  insertBlock(quill, { name: COLUMNS_EMBED, value }, value.id);
}

export function undo(quill: Quill) {
  quill.history.undo();
}

export function redo(quill: Quill) {
  quill.history.redo();
}
