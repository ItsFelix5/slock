import { MIN_PANE_WIDTH, type Pane, PaneDivider } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { createSignal, Show } from "solid-js";

const MAX_INITIAL_FRACTION = 0.65;

export default function ScrollingCell<T>(props: {
  pane: Pane<T>;
  last: boolean;
  alone: boolean;
  viewport: number;
  children: JSX.Element;
}) {
  let seeded: number | undefined;
  const seedWidth = () =>
    (seeded ??= Math.max(
      MIN_PANE_WIDTH,
      Math.min(props.pane.size, MAX_INITIAL_FRACTION) * props.viewport,
    ));
  const [dragged, setDragged] = createSignal<number>();
  const width = () => dragged() ?? seedWidth();

  return (
    <>
      <div
        class="scrolling-cell flex-col"
        data-cell={props.pane.id}
        style={{ width: props.alone ? "100%" : `${width()}px` }}
      >
        {props.children}
      </div>
      <Show when={!props.last}>
        <PaneDivider
          onDrag={(delta) => {
            setDragged((current = seedWidth()) =>
              Math.min(props.viewport, Math.max(MIN_PANE_WIDTH, current + delta * props.viewport)),
            );
          }}
          positionPercent={Math.round((width() / props.viewport) * 100)}
        />
      </Show>
    </>
  );
}
