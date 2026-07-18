import type { InputBlock } from "@slock/slack-api";
import { Show } from "solid-js";
import BkText from "../BkText";
import ElementRenderer from "../elements/ElementRenderer";

export default function Input(props: { block: InputBlock }) {
  return (
    <div class="bk-input">
      <div class="bk-input-label">
        <BkText text={props.block.label} />
      </div>
      <ElementRenderer blockId={props.block.block_id} el={props.block.element} />
      <Show when={props.block.hint}>
        <div class="bk-input-hint">
          <BkText text={props.block.hint} />
        </div>
      </Show>
    </div>
  );
}
