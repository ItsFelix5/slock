import type { PaneLayoutProps } from "@slock/ui";
import { createEffect, For, onCleanup } from "solid-js";
import ScrollingCell from "./ScrollingCell";
import { scrollLeftToReveal } from "./scrollTarget";
import "./ScrollingLayout.css";

export default function ScrollingLayout<T>(props: PaneLayoutProps<T>) {
  let rowEl: HTMLDivElement | undefined;

  const reveal = (id: string | null) => {
    const cell = id && rowEl?.querySelector<HTMLElement>(`[data-cell="${CSS.escape(id)}"]`);
    if (!(rowEl && cell)) return;
    const left = scrollLeftToReveal(
      { left: cell.offsetLeft, width: cell.offsetWidth },
      { scrollLeft: rowEl.scrollLeft, width: rowEl.clientWidth },
    );
    if (left !== undefined) rowEl.scrollLeft = left;
  };

  createEffect(() => props.activePaneId(), reveal);

  let viewportWidth = 0;
  const viewportResize = new ResizeObserver(() => {
    if (rowEl?.clientWidth === viewportWidth) return;
    viewportWidth = rowEl?.clientWidth ?? 0;
    reveal(props.activePaneId());
  });
  onCleanup(() => viewportResize.disconnect());

  return (
    <div
      class="scrolling-layout"
      ref={(el) => {
        rowEl = el;
        viewportResize.observe(el);
      }}
    >
      <For each={props.panes}>
        {(pane, i) => (
          <ScrollingCell
            alone={props.panes.length === 1}
            last={i() === props.panes.length - 1}
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
