import { For, type JSX, onCleanup, Show } from "solid-js";
import { tabStripKeyDown } from "../form/listNavigation";
import Icon from "../media/Icon";
import "./PaneRow.css";
import { startFrameCoalescedPointerDrag } from "../pointerDrag";
import { MIN_FRACTION, type Pane } from "./paneList";
import { distributeResize } from "./resize";

const MIN_PANE_WIDTH = 430;

function isNarrowPaneRow(containerWidth: number, paneCount: number): boolean {
  return containerWidth > 0 && containerWidth < paneCount * MIN_PANE_WIDTH;
}

export interface PaneRowProps<T> {
  panes: Pane<T>[];
  renderPane: (pane: Pane<T>) => JSX.Element;
  onResize: (sizes: number[]) => void;
  minFraction?: number;
  tabLabel?: (pane: Pane<T>) => JSX.Element;
  onCloseTab?: (pane: Pane<T>) => void;
  containerWidth: () => number;
  activePaneId: () => string | null;
  onActivate: (id: string) => void;
}

function focusTabAfterPaneAutoFocusSettles(focus: () => void) {
  queueMicrotask(focus);
}

export default function PaneRow<T>(props: PaneRowProps<T>) {
  const minFraction = () => props.minFraction ?? MIN_FRACTION;
  const narrow = () => isNarrowPaneRow(props.containerWidth(), props.panes.length);
  const tabbed = () => narrow() && !!props.tabLabel && props.panes.length > 1;
  const tabButtonRefs: (HTMLButtonElement | undefined)[] = [];

  const activePane = () => {
    const panes = props.panes;
    const wanted = panes.find((p) => p.id === props.activePaneId());
    return wanted ?? panes[panes.length - 1];
  };

  return (
    <div class="pane-row" classList={{ "pane-row-tabbed": tabbed() }}>
      <Show when={tabbed()}>
        <div class="pane-tab-strip" role="tablist">
          <For each={props.panes}>
            {(pane, i) => {
              const isActive = () => pane.id === activePane().id;
              const closeTab = () => {
                if (isActive()) {
                  const index = props.panes.findIndex((p) => p.id === pane.id);
                  const neighbor = props.panes[index + 1] ?? props.panes[index - 1];
                  if (neighbor) props.onActivate(neighbor.id);
                }
                props.onCloseTab?.(pane);
              };
              return (
                <div class="pane-tab-wrap" classList={{ active: isActive() }}>
                  <button
                    aria-selected={isActive()}
                    class="pane-tab btn-reset"
                    classList={{ active: isActive() }}
                    onAuxClick={(event) => {
                      if (event.button !== 1 || !props.onCloseTab) return;
                      event.preventDefault();
                      closeTab();
                    }}
                    onClick={() => props.onActivate(pane.id)}
                    onKeyDown={(event) =>
                      tabStripKeyDown(event, props.panes, i(), (next, nextIndex) => {
                        props.onActivate(next.id);
                        focusTabAfterPaneAutoFocusSettles(() => tabButtonRefs[nextIndex]?.focus());
                      })
                    }
                    onMouseDown={(event) => {
                      if (event.button === 1) event.preventDefault();
                    }}
                    ref={(el) => {
                      tabButtonRefs[i()] = el;
                    }}
                    role="tab"
                    tabIndex={isActive() ? 0 : -1}
                    type="button"
                  >
                    {props.tabLabel?.(pane)}
                  </button>
                  <Show when={props.onCloseTab}>
                    {(_onCloseTab) => (
                      <button
                        aria-label="Close tab"
                        class="pane-tab-close btn-reset flex-center"
                        onClick={(event) => {
                          event.stopPropagation();
                          closeTab();
                        }}
                        type="button"
                      >
                        <Icon name="close" size={12} />
                      </button>
                    )}
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
      <For each={props.panes}>
        {(pane, i) => (
          <>
            <div
              class="pane-cell"
              style={
                tabbed()
                  ? { flex: "1 1 auto", display: pane.id === activePane().id ? "flex" : "none" }
                  : { flex: `${pane.size} 1 0%` }
              }
            >
              {props.renderPane(pane)}
            </div>
            <Show when={!tabbed() && i() < props.panes.length - 1}>
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
            </Show>
          </>
        )}
      </For>
    </div>
  );
}

function PaneDivider(props: { positionPercent: number; onDrag: (deltaFraction: number) => void }) {
  let handleEl: HTMLHRElement | undefined;
  let stopDragging: (() => void) | undefined;

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    stopDragging?.();
    const containerSize = handleEl?.parentElement?.clientWidth || 1;
    let startPos = event.clientX;
    stopDragging = startFrameCoalescedPointerDrag((moveEvent) => {
      props.onDrag((moveEvent.clientX - startPos) / containerSize);
      startPos = moveEvent.clientX;
    });
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

  onCleanup(() => stopDragging?.());

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
