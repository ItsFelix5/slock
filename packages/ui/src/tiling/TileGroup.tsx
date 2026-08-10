import { For, type JSX, onCleanup, Show } from "solid-js";
import { distributeResize } from "./resize";
import type { Axis, TileLeaf, TileNode } from "./tree";
import "./TileGroup.css";

const MIN_FRACTION = 0.12;

export interface TileGroupProps<T> {
  tree: TileNode<T>;
  renderLeaf: (leaf: TileLeaf<T>) => JSX.Element;
  onResize: (splitId: string, sizes: number[]) => void;
  minFraction?: number;
}

// Renders a tile tree as nested flex splits with resize dividers between
// children. A single-leaf tree renders `renderLeaf` directly with no
// wrapper — chrome only exists inside split nodes, so single-pane use is
// structurally identical to a plain content render, not CSS-hidden.
export default function TileGroup<T>(props: TileGroupProps<T>) {
  return (
    <TileNodeView
      minFraction={props.minFraction ?? MIN_FRACTION}
      node={props.tree}
      onResize={props.onResize}
      renderLeaf={props.renderLeaf}
    />
  );
}

function TileNodeView<T>(props: {
  node: TileNode<T>;
  renderLeaf: (leaf: TileLeaf<T>) => JSX.Element;
  onResize: (splitId: string, sizes: number[]) => void;
  minFraction: number;
}) {
  return (
    <Show
      fallback={props.node.type === "leaf" ? props.renderLeaf(props.node) : null}
      when={props.node.type === "split" ? props.node : undefined}
    >
      {(split) => (
        <div class="tile-split" classList={{ [`tile-split-${split().axis}`]: true }}>
          <For each={split().children}>
            {(child, i) => (
              <>
                <div class="tile-cell" style={{ flex: `${split().sizes[i()]} 1 0%` }}>
                  <TileNodeView
                    minFraction={props.minFraction}
                    node={child}
                    onResize={props.onResize}
                    renderLeaf={props.renderLeaf}
                  />
                </div>
                <Show when={i() < split().children.length - 1}>
                  <TileDivider
                    axis={split().axis}
                    positionPercent={Math.round(
                      split()
                        .sizes.slice(0, i() + 1)
                        .reduce((a, b) => a + b, 0) * 100,
                    )}
                    onDrag={(deltaFraction) =>
                      props.onResize(
                        split().id,
                        distributeResize(split().sizes, i(), deltaFraction, props.minFraction),
                      )
                    }
                  />
                </Show>
              </>
            )}
          </For>
        </div>
      )}
    </Show>
  );
}

function TileDivider(props: {
  axis: Axis;
  positionPercent: number;
  onDrag: (deltaFraction: number) => void;
}) {
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this through the JSX ref.
  let handleEl: HTMLHRElement | undefined;
  let startPos = 0;
  let containerSize = 1;

  const stopDragging = () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDragging);
    window.removeEventListener("pointercancel", stopDragging);
    window.removeEventListener("blur", stopDragging);
  };

  const onPointerMove = (event: PointerEvent) => {
    const pos = props.axis === "row" ? event.clientX : event.clientY;
    props.onDrag((pos - startPos) / containerSize);
    startPos = pos;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    stopDragging();
    const container = handleEl?.parentElement;
    containerSize = (props.axis === "row" ? container?.clientWidth : container?.clientHeight) || 1;
    startPos = props.axis === "row" ? event.clientX : event.clientY;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    window.addEventListener("blur", stopDragging);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const forward = props.axis === "row" ? "ArrowRight" : "ArrowDown";
    const backward = props.axis === "row" ? "ArrowLeft" : "ArrowUp";
    let delta: number | undefined;
    if (event.key === "Home") delta = -1;
    else if (event.key === "End") delta = 1;
    else if (event.key === forward) delta = event.shiftKey ? 0.1 : 0.02;
    else if (event.key === backward) delta = event.shiftKey ? -0.1 : -0.02;
    if (delta === undefined) return;
    event.preventDefault();
    props.onDrag(delta);
  };

  onCleanup(stopDragging);

  return (
    <hr
      aria-label="Resize pane"
      aria-orientation={props.axis === "row" ? "vertical" : "horizontal"}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={props.positionPercent}
      class="tile-divider"
      classList={{ [`tile-divider-${props.axis}`]: true }}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      ref={handleEl}
      tabIndex={0}
    />
  );
}
