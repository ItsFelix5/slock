import type { TimerHandle } from "@slock/core";
import { service } from "@slock/core/solid";
import type { PaneLayoutProps } from "@slock/ui";
import { createEffect, createSignal, For, onCleanup } from "solid-js";
import ScrollingCell from "./ScrollingCell";
import { scrollLeftToReveal } from "./scrollTarget";
import "./ScrollingLayout.css";

const DRAG_IDLE_MS = 150;

const env = service("env");

export default function ScrollingLayout<T>(props: PaneLayoutProps<T>) {
  let rowEl: HTMLDivElement | undefined;
  const [dragging, setDragging] = createSignal(false);
  let dragIdle: TimerHandle | undefined;
  onCleanup(() => env.clearTimeout(dragIdle));

  const markDragging = () => {
    setDragging(true);
    env.clearTimeout(dragIdle);
    dragIdle = env.setTimeout(() => setDragging(false), DRAG_IDLE_MS);
  };

  createEffect(
    () => props.activePaneId(),
    (id) => {
      if (!id) return;
      const frame = requestAnimationFrame(() => {
        const cell = rowEl?.querySelector<HTMLElement>(`[data-cell="${CSS.escape(id)}"]`);
        if (!(rowEl && cell)) return;
        const left = scrollLeftToReveal(
          { left: cell.offsetLeft, width: cell.offsetWidth },
          { scrollLeft: rowEl.scrollLeft, width: rowEl.clientWidth },
        );
        if (left !== undefined) rowEl.scrollTo({ behavior: "smooth", left });
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
