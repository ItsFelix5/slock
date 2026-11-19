import { createMemo, For, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import "./PaneRow.css";
import { defined } from "@slock/core";

import { useTabStripShortcuts } from "../hooks/useNavShortcuts";
import PaneDivider from "./PaneDivider";
import PaneTab from "./PaneTab";
import { MIN_FRACTION, type Pane } from "./paneList";
import { distributeResize } from "./resize";

export const MIN_PANE_WIDTH = 430;
const MAX_WARM_TABS = 4;

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

  const warmIds = createMemo<string[]>((previous) => {
    const id = activePane().id;
    const live = new Set(props.panes.map((p) => p.id));
    return [id, ...previous.filter((other) => other !== id && live.has(other))].slice(
      0,
      MAX_WARM_TABS,
    );
  }, []);
  const mounted = (pane: Pane<T>) => !tabbed() || warmIds().includes(pane.id);

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
                <PaneTab
                  active={isActive()}
                  hasOthers={props.panes.length > 1}
                  onActivate={() => props.onActivate(pane.id)}
                  onClose={props.onCloseTab && closeTab}
                  onCloseOthers={() => {
                    props.onActivate(pane.id);
                    for (const other of props.panes.filter((p) => p.id !== pane.id)) {
                      props.onCloseTab?.(other);
                    }
                  }}
                  tabRef={(el) => {
                    tabButtonRefs[i()] = el;
                  }}
                >
                  {props.tabLabel?.(pane)}
                </PaneTab>
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
              <Show when={mounted(pane)}>{props.renderPane(pane)}</Show>
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
