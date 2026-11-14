import { For, type JSX, Show } from "solid-js";
import Icon from "../media/Icon";
import "./PaneRow.css";
import { defined } from "@slock/core";

import { useTabStripShortcuts } from "../useNavShortcuts";
import PaneDivider from "./PaneDivider";
import { MIN_FRACTION, type Pane } from "./paneList";
import { distributeResize } from "./resize";

export const MIN_PANE_WIDTH = 430;

function isNarrowPaneRow(containerWidth: number, paneCount: number): boolean {
  return containerWidth > 0 && containerWidth < paneCount * MIN_PANE_WIDTH;
}

export interface PaneLayoutProps<T> {
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

export default function PaneRow<T>(props: PaneLayoutProps<T>) {
  const minFraction = () => props.minFraction ?? MIN_FRACTION;
  const narrow = () => isNarrowPaneRow(props.containerWidth(), props.panes.length);
  const tabbed = () => narrow() && !!props.tabLabel && props.panes.length > 1;
  const tabButtonRefs: (HTMLButtonElement | undefined)[] = [];
  let tabListRef: HTMLDivElement | undefined;
  useTabStripShortcuts({
    activate: (next, nextIndex) => {
      props.onActivate(next.id);
      focusTabAfterPaneAutoFocusSettles(() => tabButtonRefs[nextIndex]?.focus());
    },
    items: () => props.panes,
    root: () => tabListRef,
  });

  const activePane = () => {
    const { panes } = props;
    const wanted = panes.find((p) => p.id === props.activePaneId());
    return wanted ?? defined(panes[panes.length - 1]);
  };

  return (
    <div class="pane-row" classList={{ "pane-row-tabbed": tabbed() }}>
      <Show when={tabbed()}>
        <div class="pane-tab-strip" ref={tabListRef} role="tablist">
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
                <div
                  class="pane-tab-wrap flex-align-center"
                  classList={{ active: isActive() }}
                  onAuxClick={(event) => {
                    if (event.button !== 1 || !props.onCloseTab) return;
                    event.preventDefault();
                    closeTab();
                  }}
                  onMouseDown={(event) => {
                    if (event.button === 1) event.preventDefault();
                  }}
                >
                  <button
                    aria-selected={isActive()}
                    class="pane-tab truncate btn-reset"
                    classList={{ active: isActive() }}
                    onClick={() => props.onActivate(pane.id)}
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
                        class="pane-tab-close btn-reset flex-center hover-hl"
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
              class="pane-cell flex-col"
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
