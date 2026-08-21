import { createSignal, For, type JSX, onCleanup, Show } from "solid-js";
import { useNarrowPaneRow } from "./narrowLayout";
import "./PaneRow.css";
import { MIN_FRACTION, type Pane } from "./paneList";
import { distributeResize } from "./resize";

export interface PaneRowProps<T> {
  panes: Pane<T>[];
  renderPane: (pane: Pane<T>) => JSX.Element;
  onResize: (sizes: number[]) => void;
  minFraction?: number;
  tabLabel?: (pane: Pane<T>) => JSX.Element;
}

export default function PaneRow<T>(props: PaneRowProps<T>) {
  const minFraction = () => props.minFraction ?? MIN_FRACTION;
  const narrow = useNarrowPaneRow();
  const tabbed = () => narrow() && !!props.tabLabel && props.panes.length > 1;

  const [activeTabId, setActiveTabId] = createSignal<string | null>(null);
  const activePane = () => {
    const panes = props.panes;
    const wanted = panes.find((p) => p.id === activeTabId());
    return wanted ?? panes[panes.length - 1];
  };

  return (
    <Show
      fallback={
        <div class="pane-row">
          <For each={props.panes}>
            {(pane, i) => (
              <>
                <div class="pane-cell" style={{ flex: `${pane.size} 1 0%` }}>
                  {props.renderPane(pane)}
                </div>
                {i() < props.panes.length - 1 && (
                  <PaneDivider
                    onDrag={(deltaFraction) =>
                      props.onResize(
                        distributeResize(
                          props.panes.map((p) => p.size),
                          i(),
                          deltaFraction,
                          minFraction(),
                        ),
                      )
                    }
                    positionPercent={Math.round(
                      props.panes.slice(0, i() + 1).reduce((a, p) => a + p.size, 0) * 100,
                    )}
                  />
                )}
              </>
            )}
          </For>
        </div>
      }
      when={tabbed()}
    >
      <div class="pane-row pane-row-tabbed flex-col">
        <div class="pane-tab-strip" role="tablist">
          <For each={props.panes}>
            {(pane) => (
              <button
                aria-selected={pane.id === activePane().id}
                class="pane-tab btn-reset"
                classList={{ active: pane.id === activePane().id }}
                onClick={() => setActiveTabId(pane.id)}
                role="tab"
                type="button"
              >
                {props.tabLabel?.(pane)}
              </button>
            )}
          </For>
        </div>
        <div class="pane-tab-content">
          <For each={props.panes}>
            {(pane) => (
              <div
                class="pane-cell"
                style={{ display: pane.id === activePane().id ? "flex" : "none" }}
              >
                {props.renderPane(pane)}
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}

function PaneDivider(props: { positionPercent: number; onDrag: (deltaFraction: number) => void }) {
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
    props.onDrag((event.clientX - startPos) / containerSize);
    startPos = event.clientX;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    stopDragging();
    containerSize = handleEl?.parentElement?.clientWidth || 1;
    startPos = event.clientX;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    window.addEventListener("blur", stopDragging);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    let delta: number | undefined;
    if (event.key === "Home") delta = -1;
    else if (event.key === "End") delta = 1;
    else if (event.key === "ArrowRight") delta = event.shiftKey ? 0.1 : 0.02;
    else if (event.key === "ArrowLeft") delta = event.shiftKey ? -0.1 : -0.02;
    if (delta === undefined) return;
    event.preventDefault();
    props.onDrag(delta);
  };

  onCleanup(stopDragging);

  return (
    <hr
      aria-label="Resize pane"
      aria-orientation="vertical"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={props.positionPercent}
      class="pane-divider"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      ref={handleEl}
      tabIndex={0}
    />
  );
}
