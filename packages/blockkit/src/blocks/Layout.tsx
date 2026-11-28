import type { Block, LayoutBlock } from "@slock/types";
import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";
import "./Layout.css";

const WEIGHT = { narrow: 1, standard: 2, wide: 3 };

export default function Layout(props: {
  block: LayoutBlock;
  render: (block: Block) => JSX.Element;
}) {
  return (
    <section class={["bk-layout", `bk-layout--${props.block.grid_lines ?? "none"}`]}>
      <Show when={props.block.is_label_visible}>
        <div class="bk-layout-label">{props.block.label}</div>
      </Show>
      <For each={props.block.rows}>
        {(row) => (
          <div class="bk-layout-row">
            <For each={row.items}>
              {(item) => (
                <div
                  class="bk-layout-item"
                  data-align={item.horizontal_alignment}
                  style={{ "flex-grow": WEIGHT[item.width ?? "standard"] }}
                >
                  {props.render(item.block)}
                </div>
              )}
            </For>
          </div>
        )}
      </For>
    </section>
  );
}
