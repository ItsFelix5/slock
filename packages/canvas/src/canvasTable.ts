import { asDouble, asMessage, asString, field, type RawMessage } from "./protobufRaw.ts";

export interface RawTable {
  cellContentIds: Map<string, string>;
  cellIds: Map<string, string>;
  colIds: string[];
  colKeys: Map<string, string>;
  colWidths: number[];
  rowIds: string[];
  rowKeys: Map<string, string>;
}

const FIELD_TABLE = 30;

function byKey(entries: { id: string; key: string }[]): string[] {
  return entries
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index))
    .map((entry) => entry.id);
}

export function tableGrid(content: RawMessage): RawTable | null {
  const table = asMessage(field(content, FIELD_TABLE));
  if (!table) return null;
  const rows: { id: string; key: string }[] = [];
  for (const rowEntry of table.get(1) ?? []) {
    const rowMsg = asMessage(rowEntry);
    const rowIdMsg = rowMsg && asMessage(field(rowMsg, 1));
    const id = rowIdMsg && asString(field(rowIdMsg, 14));
    if (rowMsg && id) rows.push({ id, key: asString(field(rowMsg, 2)) ?? "" });
  }
  const cols: { id: string; key: string; width: number }[] = [];
  for (const colEntry of table.get(2) ?? []) {
    const colMsg = asMessage(colEntry);
    const id = colMsg && asString(field(colMsg, 1));
    if (!(colMsg && id)) continue;
    cols.push({
      id,
      key: asString(field(colMsg, 2)) ?? "",
      width: asDouble(field(colMsg, 3)) ?? 0,
    });
  }
  const colIds = byKey(cols);
  const widthOf = new Map(cols.map((col) => [col.id, col.width]));
  const cellContentIds = new Map<string, string>();
  const cellIds = new Map<string, string>();
  for (const cellEntry of table.get(3) ?? []) {
    const cellMsg = asMessage(cellEntry);
    if (!cellMsg) continue;
    const rowRefMsg = asMessage(field(cellMsg, 2));
    const rowId = rowRefMsg && asString(field(rowRefMsg, 14));
    const colId = asString(field(cellMsg, 3));
    const contentId = asString(field(cellMsg, 4));
    const cellId = asString(field(cellMsg, 1));
    if (rowId && colId && contentId) cellContentIds.set(`${rowId} ${colId}`, contentId);
    if (rowId && colId && cellId) cellIds.set(`${rowId} ${colId}`, cellId);
  }
  return {
    cellContentIds,
    cellIds,
    colIds,
    colKeys: new Map(cols.map((col) => [col.id, col.key])),
    colWidths: colIds.map((id) => widthOf.get(id) ?? 0),
    rowIds: byKey(rows),
    rowKeys: new Map(rows.map((row) => [row.id, row.key])),
  };
}
