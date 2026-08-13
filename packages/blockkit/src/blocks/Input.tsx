import type { InputBlock } from "@slock/slack-api";
import { Show } from "solid-js";
import BkText from "../BkText";
import ElementRenderer from "../elements/ElementRenderer";
import type { BlockActionContext } from "../BlockKit";

export default function Input(props: { block: InputBlock; context?: BlockActionContext }) {
  return (
    <div class="bk-input">
      <div class="bk-input-label">
        <BkText text={props.block.label} />
      </div>
      <ElementRenderer
        blockId={props.block.block_id}
        context={props.context}
        el={props.block.element}
      />
      <Show when={props.block.hint}>
        <div class="bk-input-hint">
          <BkText text={props.block.hint} />
        </div>
      </Show>
    </div>
  );
}
