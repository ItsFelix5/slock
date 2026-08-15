import type { SectionBlock } from "@slock/slack-api";
import { createSignal, For, onMount, Show } from "solid-js";
import BkText from "../BkText";
import type { BlockActionContext } from "../BlockKit";
import ElementRenderer from "../elements/ElementRenderer";

export default function Section(props: { block: SectionBlock; context?: BlockActionContext }) {
  const [expanded, setExpanded] = createSignal(false);
  const [overflowing, setOverflowing] = createSignal(false);
  const clampable = () => props.block.expand !== true;
  // biome-ignore lint/suspicious/noUnassignedVariables: standard Solid ref pattern
  let textEl: HTMLDivElement | undefined;

  onMount(() => {
    if (!(textEl && clampable())) return;
    setOverflowing(textEl.scrollHeight - textEl.clientHeight > 2);
  });

  return (
    <div class="bk-section">
      <div class="bk-section-main">
        <Show when={props.block.text}>
          <div
            class="bk-section-text"
            classList={{ "bk-section-text--clamped": clampable() && !expanded() }}
            ref={textEl}
          >
            <BkText text={props.block.text} />
          </div>
        </Show>
        <Show when={clampable() && overflowing()}>
          <button class="bk-section-expand" onClick={() => setExpanded((v) => !v)} type="button">
            {expanded() ? "Show less" : "Show more"}
          </button>
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
