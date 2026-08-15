import type { DocModel } from "./docModel";

/** The cell path (`[tableIdx, rowIdx, cellIdx, 0]`) Tab/Shift+Tab lands on from `path` — row-major,
 * wrapping to the next/previous row at either edge. Returns null past the table's first/last cell. */
export function adjacentCellPath<A>(
  doc: DocModel<A>,
  path: number[],
  dir: 1 | -1,
): number[] | null {
  const table = doc.blocks[path[0]];
  if (table?.kind !== "table") return null;
  let [, row, cell] = path;
  cell += dir;
  const rowLength = (r: number) => table.rows[r]?.cells.length ?? 0;
  if (cell < 0) {
    row -= 1;
    cell = rowLength(row) - 1;
  } else if (cell >= rowLength(row)) {
    row += 1;
    cell = 0;
  }
  if (row < 0 || row >= table.rows.length || cell < 0) return null;
  return [path[0], row, cell, 0];
}
