import { MIN_PANE_WIDTH, type Pane, PaneDivider } from "@slock/ui";
import { createSignal, type JSX, Show, untrack } from "solid-js";

const MAX_INITIAL_FRACTION = 0.65;

export default function ScrollingCell<T>(props: {
  pane: Pane<T>;
  last: boolean;
  alone: boolean;
  dragging: boolean;
  viewport: number;
  onDrag: () => void;
  children: JSX.Element;
}) {
  const [width, setWidth] = createSignal(
    untrack(() =>
      Math.max(MIN_PANE_WIDTH, Math.min(props.pane.size, MAX_INITIAL_FRACTION) * props.viewport),
    ),
  );

  return (
    <>
      <div
        class="scrolling-cell flex-col"
        classList={{ dragging: props.dragging }}
        data-cell={props.pane.id}
        style={{ width: props.alone ? "100%" : `${width()}px` }}
      >
        {props.children}
      </div>
      <Show when={!props.last}>
        <PaneDivider
          onDrag={(delta) => {
            props.onDrag();
            setWidth((current) =>
              Math.min(props.viewport, Math.max(MIN_PANE_WIDTH, current + delta * props.viewport)),
            );
          }}
          positionPercent={Math.round((width() / props.viewport) * 100)}
        />
      </Show>
    </>
  );
}
