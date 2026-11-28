import { Icon } from "@slock/ui";
import type Quill from "@slock/ui/editor/quill";
import type { Op } from "@slock/ui/editor/quill";
import { createSignal, For, Show, untrack } from "solid-js";
import type { TableEmbedRow, TableEmbedValue } from "../../lib/canvasEmbedValues";
import CanvasSurface from "../CanvasSurface";
import { useCanvasServices } from "./canvasServices";
import type { EmbedViewProps } from "./defineCanvasEmbed";
import { undoableEmbedChange } from "./embedHistory";
import { liveOps, parentScope, removeEmbed, resizeStep } from "./embedOwner";
import { CELL_FORMATS } from "./formats";
import { bindTableCell, focusCell, type TableActions } from "./tableCell";

const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 60;
const KEY_RESIZE = 20;
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
      id: `row:${created.newId().slice(-25)}`,
    };
  }

  function restructure(change: () => void) {
    undoableEmbedChange(props.node, change);
    notify();
  }

  function addRow(after: number) {
    const row = blankRow();
    if (!row) return false;
    const next = [...rows()];
    next.splice(after + 1, 0, row);
    restructure(() => setRows(next));
    return true;
  }

  function forget(cells: TableEmbedRow["cells"]) {
    for (const { contentId } of cells) quills.delete(contentId);
  }

  function removeRow(index: number, column: number) {
    if (rows().length <= 1) return;
    const removed = rows()[index]?.cells ?? [];
    restructure(() => setRows(rows().filter((_, i) => i !== index)));
    forget(removed);
    queueMicrotask(() => focusCell(actions, index, column));
  }

  function addColumn(after: number) {
    const created = services();
    if (!created) return;
    const column = { id: `col:${created.newId().slice(-25)}`, width: DEFAULT_WIDTH };
    const nextColumns = [...columns()];
    nextColumns.splice(after + 1, 0, column);
    const nextRows = rows().map((row) => {
      const cells = [...row.cells];
      cells.splice(after + 1, 0, { contentId: created.newId(), ops: BLANK_CELL });
      return { ...row, cells };
    });
    restructure(() => {
      setColumns(nextColumns);
      setRows(nextRows);
    });
  }

  function removeColumn(index: number, row: number) {
    if (columns().length <= 1) return;
    const removed = rows().flatMap((entry) => entry.cells.filter((_, i) => i === index));
    restructure(() => {
      setColumns(columns().filter((_, i) => i !== index));
      setRows(
        rows().map((entry) => ({ ...entry, cells: entry.cells.filter((_, i) => i !== index) })),
      );
    });
    forget(removed);
    queueMicrotask(() => focusCell(actions, row, index));
  }

  function widen(origin: TableEmbedValue["columns"], index: number, delta: number) {
    const width = Math.max(MIN_WIDTH, (origin[index]?.width ?? DEFAULT_WIDTH) + delta);
    setColumns(
      origin.map((column, i) => (i === index ? { ...column, width: Math.round(width) } : column)),
    );
  }

  function step(index: number, direction: -1 | 1) {
    widen(columns(), index, direction * KEY_RESIZE);
    notify();
  }

  const actions: TableActions = {
    addColumn,
    addRow,
    columns: () => untrack(columns).length,
    node: props.node,
    position(contentId) {
      const current = untrack(rows);
      const row = current.findIndex((entry) =>
        entry.cells.some((cell) => cell.contentId === contentId),
      );
      const column = current[row]?.cells.findIndex((cell) => cell.contentId === contentId) ?? 0;
      return { column, row };
    },
    quillAt: (row, column) => quills.get(untrack(rows)[row]?.cells[column]?.contentId ?? ""),
    removeColumn,
    removeRow,
    rows: () => untrack(rows).length,
    widen: step,
  };

  function startResize(event: PointerEvent, index: number) {
    const table = tableRef;
    if (!table) return;
    event.preventDefault();
    const start = event.clientX;
    const origin = columns();
    const scale =
      origin.reduce((sum, column) => sum + column.width, 0) / table.getBoundingClientRect().width;
    const move = (next: PointerEvent) => widen(origin, index, (next.clientX - start) * scale);
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      notify();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function nudge(event: KeyboardEvent, index: number) {
    const direction = resizeStep(event);
    if (direction) step(index, direction);
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
                              onReady={(quill) => {
                                quills.set(cell.contentId, quill);
                                bindTableCell(quill, cell.contentId, actions);
                              }}
                              scope={() => `${parentScope(props.node)}${cell.contentId}/`}
                              services={ready()}
                            />
                          )}
                        </Show>
                        <Show when={services()?.access === "edit" && rowIndex() === 0}>
                          <button
                            aria-label="Remove column"
                            class="canvas-table-remove canvas-table-remove-column btn-reset"
                            onClick={() => removeColumn(columnIndex(), 0)}
                            type="button"
                          >
                            <Icon name="close" size={11} />
                          </button>
                        </Show>
                        <Show
                          when={
                            services()?.access === "edit" &&
                            rowIndex() === 0 &&
                            columnIndex() < columns().length - 1
                          }
                        >
                          <div
                            aria-orientation="vertical"
                            aria-valuenow={columns()[columnIndex()]?.width}
                            class="canvas-table-handle"
                            onKeyDown={(event) => nudge(event, columnIndex())}
                            onPointerDown={(event) => startResize(event, columnIndex())}
                            role="separator"
                            tabindex={0}
                          />
                        </Show>
                        <Show
                          when={
                            services()?.access === "edit" && columnIndex() === row.cells.length - 1
                          }
                        >
                          <button
                            aria-label="Remove row"
                            class="canvas-table-remove canvas-table-remove-row btn-reset"
                            onClick={() => removeRow(rowIndex(), columnIndex())}
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
      <Show when={services()?.access === "edit"}>
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
