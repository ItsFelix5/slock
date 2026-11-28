import type { CanvasEdit, CanvasLine, CanvasNode, CanvasTable, LayoutFrame } from "@slock/types";
import { isLineNode } from "./frames.ts";
import { FULL_WIDTH_WEIGHT } from "./layoutContent.ts";
import { isSectionId } from "./sections.ts";

const MAX_COLUMNS = 6;
const MAX_HTML_LENGTH = 200_000;
const MAX_INDENT = 8;
const MAX_ITEMS = 5000;
const MAX_COLOR = 8;

type KnownIds = ReadonlyMap<string, unknown>;

function isUsableId(id: string, known: KnownIds): boolean {
  return known.has(id) || isSectionId(id);
}

function validFrames(frames: LayoutFrame[], known: KnownIds): boolean {
  return frames.every((frame) => {
    if (frame.kind === "callout") return frame.color >= 0 && frame.color <= MAX_COLOR;
    if (frame.kind !== "columns") return true;
    return (
      isUsableId(frame.id, known) &&
      frame.index >= 0 &&
      frame.index < frame.weights.length &&
      frame.weights.length <= MAX_COLUMNS &&
      frame.weights.every((weight) => weight > 0 && weight <= FULL_WIDTH_WEIGHT)
    );
  });
}

const MAX_CELLS = 2000;

function validateTable(node: CanvasTable, known: KnownIds): string | null {
  const width = node.columns.length;
  if (width === 0 || node.rows.length === 0) return "invalid_table";
  if (width * node.rows.length > MAX_CELLS) return "edit_too_large";
  const ids = new Set<string>();
  for (const row of node.rows) {
    if (row.cells.length !== width || !row.id.startsWith("row:")) return "invalid_table";
    for (const cell of row.cells) {
      if (!isUsableId(cell.contentId, known) || ids.has(cell.contentId)) return "invalid_table";
      if (cell.html.length > MAX_HTML_LENGTH) return "line_too_long";
      ids.add(cell.contentId);
    }
  }
  return node.columns.every((column) => column.id.startsWith("col:") && column.width >= 0)
    ? null
    : "invalid_table";
}

function validateLine(line: CanvasLine): string | null {
  if (line.html.length > MAX_HTML_LENGTH) return "line_too_long";
  if (line.indent < 0 || line.indent > MAX_INDENT) return "invalid_indent";
  if (line.level < 0 || line.level > 6) return "invalid_level";
  return null;
}

function validateNode(node: CanvasNode, known: KnownIds): string | null {
  if (node.kind === "table") return validateTable(node, known);
  return isLineNode(node) ? validateLine(node) : null;
}

export function validate(edit: CanvasEdit, known: KnownIds): string | null {
  if (Math.max(edit.upserts.length, edit.deleted.length, edit.controls.length) > MAX_ITEMS)
    return "edit_too_large";
  for (const control of edit.controls) if (!isSectionId(control.id)) return "invalid_id";
  for (const { node } of edit.upserts) {
    if (!isUsableId(node.id, known)) return "invalid_id";
    if (!validFrames(node.frames, known)) return "invalid_layout";
    if (node.kind === "image" && (node.weight <= 0 || node.weight > FULL_WIDTH_WEIGHT))
      return "invalid_layout";
    const invalid = validateNode(node, known);
    if (invalid) return invalid;
  }
  return null;
}
