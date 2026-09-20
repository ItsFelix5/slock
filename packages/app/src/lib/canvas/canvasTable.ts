import { asDouble, asMessage, asString, field, type RawMessage } from "./protobufRaw.ts";

export interface RawTable {
  cellContentIds: Map<string, string>;
  colIds: string[];
  colWidths: number[];
  rowIds: string[];
}

export function tableGrid(content: RawMessage): RawTable | null {
  const table = asMessage(field(content, 30));
  if (!table) return null;
  const rowIds: string[] = [];
  for (const rowEntry of table.get(1) ?? []) {
    const rowMsg = asMessage(rowEntry);
    const rowIdMsg = rowMsg && asMessage(field(rowMsg, 1));
    const rowId = rowIdMsg && asString(field(rowIdMsg, 14));
    if (rowId) rowIds.push(rowId);
  }
  const cols: { colId: string; orderKey: string; width: number }[] = [];
  for (const colEntry of table.get(2) ?? []) {
    const colMsg = asMessage(colEntry);
    const colId = colMsg && asString(field(colMsg, 1));
    if (!colId) continue;
    const orderKey = asString(field(colMsg, 2)) ?? "";
    const width = asDouble(field(colMsg, 3)) ?? 0;
    cols.push({ colId, orderKey, width });
  }
  cols.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
  const colIds = cols.map((col) => col.colId);
  const colWidths = cols.map((col) => col.width);
  const cellContentIds = new Map<string, string>();
  for (const cellEntry of table.get(3) ?? []) {
    const cellMsg = asMessage(cellEntry);
    if (!cellMsg) continue;
    const rowRefMsg = asMessage(field(cellMsg, 2));
    const rowId = rowRefMsg && asString(field(rowRefMsg, 14));
    const colId = asString(field(cellMsg, 3));
    const contentId = asString(field(cellMsg, 4));
    if (rowId && colId && contentId) cellContentIds.set(`${rowId} ${colId}`, contentId);
  }
  return { cellContentIds, colIds, colWidths, rowIds };
}
