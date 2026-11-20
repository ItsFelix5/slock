import type { PaneLayoutProps } from "@slock/ui";
import { createEffect, createSignal, For, onCleanup } from "solid-js";
import ScrollingCell from "./ScrollingCell";
import "./ScrollingLayout.css";

const DRAG_IDLE_MS = 150;

export default function ScrollingLayout<T>(props: PaneLayoutProps<T>) {
  let rowEl: HTMLDivElement | undefined;
  const [dragging, setDragging] = createSignal(false);
  let dragIdle: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(dragIdle));

  const markDragging = () => {
    setDragging(true);
    clearTimeout(dragIdle);
    dragIdle = setTimeout(() => setDragging(false), DRAG_IDLE_MS);
  };

  createEffect(
    () => props.activePaneId(),
    (id) => {
      if (!id) return;
      const frame = requestAnimationFrame(() => {
        const cell = rowEl?.querySelector<HTMLElement>(`[data-cell="${CSS.escape(id)}"]`);
        if (!(rowEl && cell)) return;
        const left = cell.offsetLeft;
        const right = left + cell.offsetWidth;
        if (left >= rowEl.scrollLeft && right <= rowEl.scrollLeft + rowEl.clientWidth) return;
        rowEl.scrollTo({
          behavior: "smooth",
          left: left - (rowEl.clientWidth - cell.offsetWidth) / 2,
        });
      });
      return () => cancelAnimationFrame(frame);
    },
  );

  return (
    <div class="scrolling-layout" ref={rowEl}>
      <For each={props.panes}>
        {(pane, i) => (
          <ScrollingCell
            alone={props.panes.length === 1}
            dragging={dragging()}
            last={i() === props.panes.length - 1}
            onDrag={markDragging}
            pane={pane}
            viewport={props.containerWidth()}
          >
            {props.renderPane(pane)}
          </ScrollingCell>
        )}
      </For>
    </div>
  );
}
