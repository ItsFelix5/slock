import { PaneDivider, type PaneLayoutProps } from "@slock/ui";
import { For, Show } from "solid-js";
import "./MasterLayout.css";

const MIN_MASTER = 0.2;
const MAX_MASTER = 0.8;

const clampMaster = (fraction: number) => Math.min(MAX_MASTER, Math.max(MIN_MASTER, fraction));

export default function MasterLayout<T>(props: PaneLayoutProps<T>) {
  const count = () => props.panes.length;
  const stacked = () => count() > 1;
  const stackRows = () => Math.max(1, count() - 1);
  const master = () => (stacked() ? clampMaster(props.panes[0]?.size ?? 0.5) : 1);

  const resizeMaster = (delta: number) => {
    const next = clampMaster(master() + delta);
    props.onResize(props.panes.map((_, i) => (i === 0 ? next : (1 - next) / stackRows())));
  };

  return (
    <div
      class="master-layout"
      style={{
        "grid-template-columns": `minmax(0, ${master()}fr) ${stacked() ? 3 : 0}px minmax(0, ${1 - master()}fr)`,
        "grid-template-rows": `repeat(${stackRows()}, minmax(0, 1fr))`,
      }}
    >
      <For each={props.panes}>
        {(pane, i) => (
          <div
            class="master-cell flex-col"
            classList={{ "master-stacked": i() > 0 }}
            style={
              i() === 0
                ? { "grid-column": 1, "grid-row": `1 / span ${stackRows()}` }
                : { "grid-column": 3, "grid-row": i() }
            }
          >
            {props.renderPane(pane)}
          </div>
        )}
      </For>
      <Show when={stacked()}>
        <PaneDivider onDrag={resizeMaster} positionPercent={Math.round(master() * 100)} />
      </Show>
    </div>
  );
}
