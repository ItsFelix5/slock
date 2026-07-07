import { For } from 'solid-js';
import type { ActionsBlock } from '../types';
import ElementRenderer from '../elements/ElementRenderer';

export default function Actions(props: { block: ActionsBlock }) {
  return (
    <div class="bk-actions">
      <For each={props.block.elements}>{(el) => <ElementRenderer el={el} />}</For>
    </div>
  );
}
