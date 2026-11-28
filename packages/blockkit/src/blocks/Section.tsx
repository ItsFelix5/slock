import type { SectionBlock } from "@slock/types";
import { Clamp } from "@slock/ui";
import { For, Show } from "solid-js";
import BkText from "../BkText";
import type { BlockActionContext } from "../BlockKit";
import ElementRenderer from "../elements/ElementRenderer";
import "./Section.css";

export default function Section(props: { block: SectionBlock; context?: BlockActionContext }) {
  const stacked = () => {
    const type = props.block.accessory?.type;
    return type === "checkboxes" || type === "radio_buttons";
  };

  return (
    <div class={["bk-section", { "bk-section--stacked": stacked() }]}>
      <div class="bk-section-main">
        <Show when={props.block.text}>
          <Clamp class="bk-section-text" lines={props.block.expand ? undefined : 15}>
            <BkText text={props.block.text} />
          </Clamp>
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
