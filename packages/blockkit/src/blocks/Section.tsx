import type { SectionBlock } from "@slock/slack-api";
import { For, Show } from "solid-js";
import BkText from "../BkText";
import type { BlockActionContext } from "../BlockKit";
import ElementRenderer from "../elements/ElementRenderer";

export default function Section(props: { block: SectionBlock; context?: BlockActionContext }) {
  return (
    <div class="bk-section">
      <div class="bk-section-main">
        <Show when={props.block.text}>
          <div class="bk-section-text">
            <BkText text={props.block.text} />
          </div>
        </Show>
        <Show when={props.block.fields?.length}>
          <div class="bk-section-fields">
            <For each={props.block.fields}>
              {(f) => (
                <div class="bk-section-field">
                  <BkText text={f} />
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
      <Show when={props.block.accessory}>
        {(accessory) => (
          <div class="bk-section-accessory">
            <ElementRenderer
              blockId={props.block.block_id}
              context={props.context}
              el={accessory()}
            />
          </div>
        )}
      </Show>
    </div>
  );
}
