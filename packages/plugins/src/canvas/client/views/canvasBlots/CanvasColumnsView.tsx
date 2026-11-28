import { Icon } from "@slock/ui";
import type Quill from "@slock/ui/editor/quill";
import type { Op } from "@slock/ui/editor/quill";
import { createSignal, For, Show, untrack } from "solid-js";
import { leaveBlock, onEdgeRow, placeCaret } from "../../lib/canvasCaret";
import { setBlockCommands } from "../../lib/canvasCommands";
import { bindFirst } from "../../lib/canvasEditorSetup";
import type { ColumnsEmbedValue } from "../../lib/canvasEmbedValues";
import CanvasSurface from "../CanvasSurface";
import { useCanvasServices } from "./canvasServices";
import type { EmbedViewProps } from "./defineCanvasEmbed";
import { forwardHistory, undoableEmbedChange } from "./embedHistory";
import { liveOps, parentScope, removeEmbed, resizeStep } from "./embedOwner";
import { COLUMN_FORMATS } from "./formats";

interface Column {
  key: number;
  ops: Op[];
  quill?: Quill;
}

const MAX_COLUMNS = 4;
const MIN_COLUMNS = 2;
const TOTAL_WEIGHT = 6;

function equalWeights(count: number): number[] {
  if (count === 2) return [3, 3];
  return Array.from({ length: count }, () => Math.max(1, Math.round(TOTAL_WEIGHT / count)));
}

export default function CanvasColumnsView(props: EmbedViewProps<ColumnsEmbedValue>) {
  const services = useCanvasServices(props.node);
  let nextKey = 0;
  const [columns, setColumns] = createSignal<Column[]>(
    props.value.columns.map((ops) => ({ key: nextKey++, ops })),
  );
  const [weights, setWeights] = createSignal(props.value.weights);
  let gridRef: HTMLDivElement | undefined;

  props.bind(() => ({
    columns: columns().map((column) => liveOps(column.quill) ?? column.ops),
    id: props.value.id,
    weights: weights(),
  }));

  function notify() {
    const quill = columns().find((column) => column.quill)?.quill;
    if (quill) services()?.afterChange(quill);
  }

  function restructure(next: Column[]) {
    undoableEmbedChange(props.node, () => {
      setColumns(next);
      setWeights(equalWeights(next.length));
    });
    notify();
  }

  function addColumn() {
    const created = services();
    if (!created || columns().length >= MAX_COLUMNS) return;
    const ops: Op[] = [{ attributes: { sid: created.newId() }, insert: "\n" }];
    restructure([...columns(), { key: nextKey++, ops }]);
  }

  function removeColumn(key: number) {
    if (columns().length <= MIN_COLUMNS) return;
    const index = columns().findIndex((column) => column.key === key);
    restructure(columns().filter((column) => column.key !== key));
    const quill = columns()[Math.max(index - 1, 0)]?.quill;
    if (quill) placeCaret(quill, -1);
  }

  function shiftSplit(origin: number[], index: number, shift: number) {
    const pair = (origin[index] ?? 0) + (origin[index + 1] ?? 0);
    const left = Math.min(Math.max((origin[index] ?? 1) + shift, 1), pair - 1);
    setWeights(
      origin.map((weight, i) => (i === index ? left : i === index + 1 ? pair - left : weight)),
    );
  }

  function startResize(event: PointerEvent, index: number) {
    const grid = gridRef;
    if (!grid) return;
    event.preventDefault();
    const start = event.clientX;
    const origin = weights();
    const unit =
      grid.getBoundingClientRect().width / origin.reduce((sum, weight) => sum + weight, 0);
    const move = (next: PointerEvent) =>
      shiftSplit(origin, index, Math.round((next.clientX - start) / unit));
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      notify();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function step(index: number, direction: -1 | 1) {
    shiftSplit(weights(), index, direction);
    notify();
  }

  function nudge(event: KeyboardEvent, index: number) {
    const direction = resizeStep(event);
    if (direction) step(index, direction);
  }

  function bindColumn(quill: Quill, key: number) {
    const at = () => untrack(columns).findIndex((column) => column.key === key);
    // The last column has no split of its own, so it moves the one to its left the other way.
    const widen = (direction: -1 | 1) => {
      const split = Math.min(at(), untrack(columns).length - 2);
      step(split, split === at() ? direction : direction === 1 ? -1 : 1);
    };
    const vertical = (direction: -1 | 1) => {
      if (!onEdgeRow(quill, direction)) return true;
      leaveBlock(props.node, direction);
      return false;
    };
    bindFirst(quill, { collapsed: true, key: "ArrowDown" }, () => vertical(1));
    bindFirst(quill, { collapsed: true, key: "ArrowUp" }, () => vertical(-1));
    forwardHistory(quill, props.node);
    setBlockCommands(quill, [
      { icon: "plus", name: "Add column", run: addColumn },
      { icon: "trash", name: "Remove column", run: () => removeColumn(key) },
      { icon: "arrow-expand", name: "Wider column", run: () => widen(1) },
      { icon: "arrow-collapse", name: "Narrower column", run: () => widen(-1) },
      { icon: "trash", name: "Remove columns", run: () => removeEmbed(props.node) },
    ]);
  }

  return (
    <div class="canvas-columns-block">
      <div
        class="canvas-columns"
        ref={gridRef}
        style={{
          "grid-template-columns": weights()
            .map((weight) => `${weight}fr`)
            .join(" "),
        }}
      >
        <For each={columns()}>
          {(column, index) => (
            <div class="canvas-column">
              <Show when={services()}>
                {(ready) => (
                  <CanvasSurface
                    ariaLabel={`Column ${index() + 1}`}
                    formats={COLUMN_FORMATS}
                    initialOps={column.ops}
                    nested
                    onReady={(quill) => {
                      column.quill = quill;
                      bindColumn(quill, column.key);
                    }}
                    scope={() => `${parentScope(props.node)}${props.value.id}:${index()}/`}
                    services={ready()}
                  />
                )}
              </Show>
              <Show when={services()?.access === "edit"}>
                <Show when={columns().length > MIN_COLUMNS}>
                  <button
                    aria-label="Remove column"
                    class="canvas-column-remove btn-reset"
                    onClick={() => removeColumn(column.key)}
                    type="button"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </Show>
                <Show when={index() < columns().length - 1}>
                  <div
                    aria-orientation="vertical"
                    aria-valuenow={weights()[index()]}
                    class="canvas-column-handle"
                    onKeyDown={(event) => nudge(event, index())}
                    onPointerDown={(event) => startResize(event, index())}
                    role="separator"
                    tabindex={0}
                  />
                </Show>
              </Show>
            </div>
          )}
        </For>
      </div>
      <Show when={services()?.access === "edit"}>
        <div class="canvas-block-actions">
          <Show when={columns().length < MAX_COLUMNS}>
            <button class="canvas-block-action btn-reset" onClick={addColumn} type="button">
              Add column
            </button>
          </Show>
          <button
            class="canvas-block-action btn-reset"
            onClick={() => removeEmbed(props.node)}
            type="button"
          >
            Remove columns
          </button>
        </div>
      </Show>
    </div>
  );
}
