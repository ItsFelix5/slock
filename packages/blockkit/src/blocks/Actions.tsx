import type { ActionsBlock } from "@slock/slack-api";
import { For } from "solid-js";
import ElementRenderer from "../elements/ElementRenderer";

export default function Actions(props: { block: ActionsBlock }) {
  return (
    <div class="bk-actions">
      <For each={props.block.elements}>{(el) => <ElementRenderer el={el} />}</For>
    </div>
  );
}
