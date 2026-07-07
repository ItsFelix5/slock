import { For, Show } from 'solid-js';
import type { SectionBlock } from '../types';
import BkText from '../BkText';
import ElementRenderer from '../elements/ElementRenderer';

export default function Section(props: { block: SectionBlock }) {
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
            <For each={props.block.fields}>{(f) => <div class="bk-section-field"><BkText text={f} /></div>}</For>
          </div>
        </Show>
      </div>
      <Show when={props.block.accessory}>
        <div class="bk-section-accessory">
          <ElementRenderer el={props.block.accessory!} />
        </div>
      </Show>
    </div>
  );
}
