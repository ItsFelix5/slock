import type Quill from "@slock/ui/editor/quill";
import { type Direction, leaveBlock, onEdgeRow, placeCaret } from "../../lib/canvasCaret";
import { setBlockCommands } from "../../lib/canvasCommands";
import { bindFirst } from "../../lib/canvasEditorSetup";
import { forwardHistory } from "./embedHistory";
import { removeEmbed } from "./embedOwner";

export interface TableActions {
  addColumn(after: number): void;
  addRow(after: number): boolean;
  columns(): number;
  node: Element;
  position(contentId: string): { column: number; row: number };
  quillAt(row: number, column: number): Quill | undefined;
  removeColumn(index: number, row: number): void;
  removeRow(index: number, column: number): void;
  rows(): number;
  widen(column: number, step: -1 | 1): void;
}

export function focusCell(
  table: TableActions,
  row: number,
  column: number,
  direction: Direction = -1,
) {
  const cell = table.quillAt(
    Math.min(Math.max(row, 0), table.rows() - 1),
    Math.min(Math.max(column, 0), table.columns() - 1),
  );
  if (cell) placeCaret(cell, direction);
}

export function bindTableCell(quill: Quill, contentId: string, table: TableActions) {
  const position = () => table.position(contentId);

  function step(rowDelta: number, columnDelta: number) {
    const { column, row } = position();
    const flat = (row + rowDelta) * table.columns() + column + columnDelta;
    const nextRow = Math.floor(flat / table.columns());
    const nextColumn = ((flat % table.columns()) + table.columns()) % table.columns();
    if (nextRow >= table.rows() && table.addRow(table.rows() - 1))
      queueMicrotask(() => focusCell(table, nextRow, nextColumn));
    else focusCell(table, nextRow, nextColumn);
    return false;
  }

  function vertical(direction: Direction) {
    if (!onEdgeRow(quill, direction)) return true;
    const { column, row } = position();
    const next = row + direction;
    if (next < 0 || next >= table.rows()) leaveBlock(table.node, direction);
    else focusCell(table, next, column, direction);
    return false;
  }

  bindFirst(quill, { key: "Enter" }, () => step(1, 0));
  bindFirst(quill, { key: "Tab" }, () => step(0, 1));
  bindFirst(quill, { key: "Tab", shiftKey: true }, () => step(0, -1));
  bindFirst(quill, { collapsed: true, key: "ArrowDown" }, () => vertical(1));
  bindFirst(quill, { collapsed: true, key: "ArrowUp" }, () => vertical(-1));
  forwardHistory(quill, table.node);

  setBlockCommands(quill, [
    { icon: "plus", name: "Add row", run: () => table.addRow(position().row) },
    { icon: "plus", name: "Add column", run: () => table.addColumn(position().column) },
    {
      icon: "trash",
      name: "Remove row",
      run: () => table.removeRow(position().row, position().column),
    },
    {
      icon: "trash",
      name: "Remove column",
      run: () => table.removeColumn(position().column, position().row),
    },
    { icon: "arrow-expand", name: "Wider column", run: () => table.widen(position().column, 1) },
    {
      icon: "arrow-collapse",
      name: "Narrower column",
      run: () => table.widen(position().column, -1),
    },
    { icon: "trash", name: "Remove table", run: () => removeEmbed(table.node) },
  ]);
}
