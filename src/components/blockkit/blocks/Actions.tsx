import { For } from "solid-js";
import ElementRenderer from "../elements/ElementRenderer";
import type { ActionsBlock } from "../types";

export default function Actions(props: { block: ActionsBlock }) {
  return (
    <div class="bk-actions">
      <For each={props.block.elements}>{(el) => <ElementRenderer el={el} />}</For>
    </div>
  );
}
