import type { CanvasTable } from "@slock/types";
import { assignPositions } from "./assignPositions.ts";
import { type RawTable, tableGrid } from "./canvasTable.ts";
import { type ExistingEntry, ownPosition, sectionText } from "./flow.ts";
import { STYLE_TABLE, TYPE_TABLE } from "./lineStyles.ts";
import { asMessage, field, type RawField } from "./protobufRaw.ts";
import { encodeRawMessage, withFields } from "./rawEncode.ts";
import type { SectionRecord } from "./sections.ts";
import {
  blankWrite,
  rawMessage,
  rawString,
  rawVarint,
  type SectionWrite,
  textContent,
} from "./sectionWrite.ts";

const FIELD_TABLE = 30;
export const DEFAULT_COLUMN_WIDTH = 400;

function double(value: number): RawField {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, true);
  return { fixed64: bytes };
}

function hex(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

function keys(ids: string[], existing: Map<string, string>): string[] {
  const used = new Set(existing.values());
  return assignPositions(
    ids.map((id) => existing.get(id) ?? null),
    { floor: null },
    used,
  );
}

function gridOf(record: SectionRecord | null): RawTable | null {
  const content = record && asMessage(field(record.msg, 12));
  return content ? tableGrid(content) : null;
}

export function tableChanged(record: SectionRecord, node: CanvasTable): boolean {
  const grid = gridOf(record);
  if (!grid) return true;
  if (grid.rowIds.join(",") !== node.rows.map((row) => row.id).join(",")) return true;
  if (grid.colIds.join(",") !== node.columns.map((column) => column.id).join(",")) return true;
  if (grid.colWidths.join(",") !== node.columns.map((column) => column.width).join(","))
    return true;
  return node.rows.some((row) =>
    row.cells.some(
      (cell, index) =>
        grid.cellContentIds.get(`${row.id} ${node.columns[index]?.id}`) !== cell.contentId,
    ),
  );
}

export function tableContent(record: SectionRecord | null, node: CanvasTable): number[] {
  const grid = gridOf(record);
  const rowKeys = keys(
    node.rows.map((row) => row.id),
    grid?.rowKeys ?? new Map(),
  );
  const colKeys = keys(
    node.columns.map((column) => column.id),
    grid?.colKeys ?? new Map(),
  );
  const rows = node.rows.map((row, index) =>
    rawMessage(
      new Map([
        [1, [rawMessage(new Map([[14, [rawString(row.id)]]]))]],
        [2, [rawString(rowKeys[index] ?? "")]],
      ]),
    ),
  );
  const columns = node.columns.map((column, index) =>
    rawMessage(
      new Map([
        [1, [rawString(column.id)]],
        [2, [rawString(colKeys[index] ?? "")]],
        [3, [double(column.width || DEFAULT_COLUMN_WIDTH)]],
      ]),
    ),
  );
  const cells = node.rows.flatMap((row) =>
    row.cells.map((cell, index) => {
      const colId = node.columns[index]?.id ?? "";
      const cellId = grid?.cellIds.get(`${row.id} ${colId}`) ?? `cell:${hex(25)}`;
      return rawMessage(
        new Map([
          [1, [rawString(cellId)]],
          [2, [rawMessage(new Map([[14, [rawString(row.id)]]]))]],
          [3, [rawString(colId)]],
          [4, [rawString(cell.contentId)]],
        ]),
      );
    }),
  );
  const previous = record && asMessage(field(record.msg, 12));
  const table = withFields(
    previous && asMessage(field(previous, FIELD_TABLE)),
    new Map([
      [1, rows],
      [2, columns],
      [3, cells],
    ]),
  );
  return encodeRawMessage(withFields(previous, new Map([[FIELD_TABLE, [rawMessage(table)]]])));
}

export function newTableWrite(
  node: CanvasTable,
  placement: { layoutParent: boolean; path: string; position: string },
): SectionWrite {
  const write = blankWrite(node.id);
  write.type = TYPE_TABLE;
  write.style = STYLE_TABLE;
  write.content = tableContent(null, node);
  write.attrs = encodeRawMessage(new Map([[4, [rawVarint(0)]]]));
  write.parents = "none";
  write.layoutParent = placement.layoutParent;
  write.position = placement.position;
  write.path = placement.path;
  return write;
}

export function updatedTableWrite(existing: ExistingEntry, node: CanvasTable): SectionWrite {
  const { record } = existing;
  const write = blankWrite(record.id ?? "");
  write.sequence = record.sequence;
  write.type = record.type;
  write.style = record.style;
  write.content = tableContent(record, node);
  return write;
}

export function cellWrites(
  node: CanvasTable,
  previous: SectionRecord | null,
  records: Map<string, SectionRecord>,
  bounds: { ceiling: string | null; floor: string },
  used: Set<string>,
): SectionWrite[] {
  const grid = gridOf(previous);
  const wanted = node.rows.flatMap((row) => row.cells);
  const positions = assignPositions(
    wanted.map((cell) => {
      const record = records.get(cell.contentId);
      return record ? ownPosition(record) : null;
    }),
    bounds,
    used,
  );
  const writes: SectionWrite[] = [];
  wanted.forEach((cell, index) => {
    const position = positions[index];
    if (!position) return;
    const record = records.get(cell.contentId);
    if (record) {
      const content = asMessage(field(record.msg, 12));
      const write = blankWrite(cell.contentId);
      write.sequence = record.sequence;
      write.type = record.type;
      let changed = false;
      if (cell.html !== sectionText(record)) {
        write.content = textContent(content, content && asMessage(field(content, 1)), cell.html);
        changed = true;
      }
      if (position !== ownPosition(record) || !record.layoutParent) {
        write.position = position;
        write.path = position;
        write.layoutParent = true;
        changed = true;
      }
      if (changed) writes.push(write);
      return;
    }
    const write = blankWrite(cell.contentId);
    write.type = 0;
    write.style = 0;
    write.content = textContent(null, null, cell.html);
    write.attrs = encodeRawMessage(new Map([[4, [rawVarint(0)]]]));
    write.parents = "none";
    write.layoutParent = true;
    write.position = position;
    write.path = position;
    writes.push(write);
  });
  const keep = new Set(wanted.map((cell) => cell.contentId));
  for (const contentId of grid?.cellContentIds.values() ?? []) {
    const record = records.get(contentId);
    if (!record || keep.has(contentId)) continue;
    const gone = blankWrite(contentId);
    gone.deleted = true;
    gone.sequence = record.sequence;
    gone.type = record.type;
    gone.style = record.style;
    gone.content = encodeRawMessage(asMessage(field(record.msg, 12)) ?? new Map());
    writes.push(gone);
  }
  return writes;
}
