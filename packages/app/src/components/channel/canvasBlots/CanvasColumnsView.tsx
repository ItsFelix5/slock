import { Icon } from "@slock/ui";
import type Quill from "quill";
import type { Op } from "quill";
import { createSignal, For, Show } from "solid-js";
import type { ColumnsEmbedValue } from "../../../lib/canvas/canvasEmbedValues";
import CanvasSurface from "../CanvasSurface";
import { useCanvasServices } from "./canvasServices";
import type { EmbedViewProps } from "./defineCanvasEmbed";
import { liveOps, parentScope, removeEmbed } from "./embedOwner";
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

  function addColumn() {
    const created = services();
    if (!created || columns().length >= MAX_COLUMNS) return;
    const ops: Op[] = [{ attributes: { sid: created.newId() }, insert: "\n" }];
    setColumns([...columns(), { key: nextKey++, ops }]);
    setWeights(equalWeights(columns().length));
    notify();
  }

  function removeColumn(key: number) {
    if (columns().length <= MIN_COLUMNS) return;
    const index = columns().findIndex((column) => column.key === key);
    setColumns(columns().filter((column) => column.key !== key));
    setWeights(equalWeights(columns().length));
    const quill = columns()[Math.max(index - 1, 0)]?.quill;
    if (quill) services()?.afterChange(quill);
  }

  function startResize(event: PointerEvent, index: number) {
    const grid = gridRef;
    if (!grid) return;
    event.preventDefault();
    const start = event.clientX;
    const origin = weights();
    const total = origin.reduce((sum, weight) => sum + weight, 0);
    const pair = (origin[index] ?? 0) + (origin[index + 1] ?? 0);
    const unit = grid.getBoundingClientRect().width / total;
    const move = (next: PointerEvent) => {
      const shift = Math.round((next.clientX - start) / unit);
      const left = Math.min(Math.max((origin[index] ?? 1) + shift, 1), pair - 1);
      setWeights(
        origin.map((weight, i) => (i === index ? left : i === index + 1 ? pair - left : weight)),
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
                    }}
                    scope={() => `${parentScope(props.node)}${props.value.id}:${index()}/`}
                    services={ready()}
                  />
                )}
              </Show>
              <Show when={!services()?.readOnly}>
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
                    aria-hidden="true"
                    class="canvas-column-handle"
                    onPointerDown={(event) => startResize(event, index())}
                  />
                </Show>
              </Show>
            </div>
          )}
        </For>
      </div>
      <Show when={!services()?.readOnly}>
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
