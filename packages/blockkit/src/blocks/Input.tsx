import type { InputBlock } from "@slock/types";
import { createUniqueId, Show } from "solid-js";
import BkText from "../BkText";
import type { BlockActionContext } from "../BlockKit";
import ElementRenderer from "../elements/ElementRenderer";
import "./Input.css";

export default function Input(props: { block: InputBlock; context?: BlockActionContext }) {
  const labelId = createUniqueId();
  const error = () => props.context?.view?.errors()[props.block.block_id ?? ""];

  return (
    <div aria-labelledby={labelId} class="bk-input flex-col" role="group">
      <div class="bk-input-label" id={labelId}>
        <BkText text={props.block.label} />
        <Show when={props.block.optional}>
          <span class="meta-dim"> optional</span>
        </Show>
      </div>
      <ElementRenderer
        blockId={props.block.block_id}
        context={props.context}
        el={props.block.element}
        stateOnly={!!props.context?.view && !props.block.dispatch_action}
      />
      <Show when={error()}>
        <div class="inline-feedback-error" role="alert">
          {error()}
        </div>
      </Show>
      <Show when={props.block.hint}>
        <div class="bk-input-hint meta-dim">
          <BkText text={props.block.hint} />
        </div>
      </Show>
    </div>
  );
}
