import { Icon } from "@slock/ui";
import type Quill from "quill";
import type { Op } from "quill";
import { createSignal, For, Show } from "solid-js";
import { bindFirst } from "../../../lib/canvas/canvasEditorSetup";
import type { TableEmbedRow, TableEmbedValue } from "../../../lib/canvas/canvasEmbedValues";
import CanvasSurface from "../CanvasSurface";
import { useCanvasServices } from "./canvasServices";
import type { EmbedViewProps } from "./defineCanvasEmbed";
import { liveOps, parentScope, removeEmbed } from "./embedOwner";
import { CELL_FORMATS } from "./formats";

const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 60;
const BLANK_CELL: Op[] = [{ insert: "\n" }];

export default function CanvasTableView(props: EmbedViewProps<TableEmbedValue>) {
  const services = useCanvasServices(props.node);
  const [columns, setColumns] = createSignal(props.value.columns);
  const [rows, setRows] = createSignal(props.value.rows);
  const quills = new Map<string, Quill>();
  let tableRef: HTMLTableElement | undefined;

  props.bind(() => ({
    columns: columns(),
    id: props.value.id,
    rows: rows().map((row) => ({
      cells: row.cells.map((cell) => ({
        contentId: cell.contentId,
        ops: liveOps(quills.get(cell.contentId)) ?? cell.ops,
      })),
      id: row.id,
    })),
  }));

  function notify() {
    const quill = quills.values().next().value;
    if (quill) services()?.afterChange(quill);
  }

  function blankRow(): TableEmbedRow | null {
    const created = services();
    if (!created) return null;
    return {
      cells: columns().map(() => ({ contentId: created.newId(), ops: BLANK_CELL })),
      id: `w:${created.newId().slice(-25)}`,
    };
  }

  function addRow(after: number) {
    const row = blankRow();
    if (!row) return null;
    const next = [...rows()];
    next.splice(after + 1, 0, row);
    setRows(next);
    notify();
    return row;
  }

  function removeRow(index: number) {
    if (rows().length <= 1) return;
    setRows(rows().filter((_, i) => i !== index));
    notify();
  }

  function addColumn(after: number) {
    const created = services();
    if (!created) return;
    const column = { id: `col:${created.newId().slice(-25)}`, width: DEFAULT_WIDTH };
    const nextColumns = [...columns()];
    nextColumns.splice(after + 1, 0, column);
    setColumns(nextColumns);
    setRows(
      rows().map((row) => {
        const cells = [...row.cells];
        cells.splice(after + 1, 0, { contentId: created.newId(), ops: BLANK_CELL });
        return { ...row, cells };
      }),
    );
    notify();
  }

  function removeColumn(index: number) {
    if (columns().length <= 1) return;
    setColumns(columns().filter((_, i) => i !== index));
    setRows(rows().map((row) => ({ ...row, cells: row.cells.filter((_, i) => i !== index) })));
    notify();
  }

  function focusCell(row: number, column: number) {
    const contentId = rows()[row]?.cells[column]?.contentId;
    const quill = contentId ? quills.get(contentId) : undefined;
    quill?.focus();
    quill?.setSelection(quill.getLength() - 1, 0);
  }

  function bindCell(quill: Quill, contentId: string) {
    quills.set(contentId, quill);
    const position = () => {
      const row = rows().findIndex((entry) =>
        entry.cells.some((cell) => cell.contentId === contentId),
      );
      const column = rows()[row]?.cells.findIndex((cell) => cell.contentId === contentId) ?? 0;
      return { column, row };
    };
    const move = (rowDelta: number, columnDelta: number) => {
      const { column, row } = position();
      let nextRow = row + rowDelta;
      let nextColumn = column + columnDelta;
      if (nextColumn >= columns().length) {
        nextColumn = 0;
        nextRow += 1;
      } else if (nextColumn < 0) {
        nextColumn = columns().length - 1;
        nextRow -= 1;
      }
      if (nextRow >= rows().length && addRow(rows().length - 1))
        queueMicrotask(() => focusCell(nextRow, nextColumn));
      else focusCell(Math.max(nextRow, 0), nextColumn);
      return false;
    };
    bindFirst(quill, { key: "Enter" }, () => move(1, 0));
    bindFirst(quill, { key: "Tab" }, () => move(0, 1));
    bindFirst(quill, { key: "Tab", shiftKey: true }, () => move(0, -1));
  }

  function startResize(event: PointerEvent, index: number) {
    const table = tableRef;
    if (!table) return;
    event.preventDefault();
    const start = event.clientX;
    const origin = columns();
    const total = origin.reduce((sum, column) => sum + column.width, 0);
    const scale = total / table.getBoundingClientRect().width;
    const move = (next: PointerEvent) => {
      const width = Math.max(
        MIN_WIDTH,
        (origin[index]?.width ?? DEFAULT_WIDTH) + (next.clientX - start) * scale,
      );
      setColumns(
        origin.map((column, i) => (i === index ? { ...column, width: Math.round(width) } : column)),
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      notify();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  const totalWidth = () => columns().reduce((sum, column) => sum + column.width, 0) || 1;

  return (
    <div class="canvas-table-block">
      <div class="canvas-table-scroll">
        <table class="canvas-table" ref={tableRef}>
          <colgroup>
            <For each={columns()}>
              {(column) => <col style={{ width: `${(column.width / totalWidth()) * 100}%` }} />}
            </For>
          </colgroup>
          <tbody>
            <For each={rows()}>
              {(row, rowIndex) => (
                <tr>
                  <For each={row.cells}>
                    {(cell, columnIndex) => (
                      <td>
                        <Show when={services()}>
                          {(ready) => (
                            <CanvasSurface
                              ariaLabel="Table cell"
                              formats={CELL_FORMATS}
                              initialOps={cell.ops}
                              nested
                              onReady={(quill) => bindCell(quill, cell.contentId)}
                              scope={() => `${parentScope(props.node)}${cell.contentId}/`}
                              services={ready()}
                            />
                          )}
                        </Show>
                        <Show when={!services()?.readOnly && rowIndex() === 0}>
                          <button
                            aria-label="Remove column"
                            class="canvas-table-remove canvas-table-remove-column btn-reset"
                            onClick={() => removeColumn(columnIndex())}
                            type="button"
                          >
                            <Icon name="close" size={11} />
                          </button>
                        </Show>
                        <Show
                          when={
                            !services()?.readOnly &&
                            rowIndex() === 0 &&
                            columnIndex() < columns().length - 1
                          }
                        >
                          <div
                            aria-hidden="true"
                            class="canvas-table-handle"
                            onPointerDown={(event) => startResize(event, columnIndex())}
                          />
                        </Show>
                        <Show
                          when={!services()?.readOnly && columnIndex() === row.cells.length - 1}
                        >
                          <button
                            aria-label="Remove row"
                            class="canvas-table-remove canvas-table-remove-row btn-reset"
                            onClick={() => removeRow(rowIndex())}
                            type="button"
                          >
                            <Icon name="close" size={11} />
                          </button>
                        </Show>
                      </td>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <Show when={!services()?.readOnly}>
        <div class="canvas-block-actions">
          <button
            class="canvas-block-action btn-reset"
            onClick={() => addRow(rows().length - 1)}
            type="button"
          >
            Add row
          </button>
          <button
            class="canvas-block-action btn-reset"
            onClick={() => addColumn(columns().length - 1)}
            type="button"
          >
            Add column
          </button>
          <button
            class="canvas-block-action btn-reset"
            onClick={() => removeEmbed(props.node)}
            type="button"
          >
            Remove table
          </button>
        </div>
      </Show>
    </div>
  );
}
