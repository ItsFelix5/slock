import type { ActionsBlock } from "@slock/slack-api";
import { For } from "solid-js";
import type { BlockActionContext } from "../BlockKit";
import ElementRenderer from "../elements/ElementRenderer";

export default function Actions(props: { block: ActionsBlock; context?: BlockActionContext }) {
  return (
    <div class="bk-actions">
      <For each={props.block.elements}>
        {(el) => <ElementRenderer blockId={props.block.block_id} context={props.context} el={el} />}
      </For>
    </div>
  );
}
