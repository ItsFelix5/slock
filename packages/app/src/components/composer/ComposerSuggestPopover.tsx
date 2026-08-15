import { For } from "solid-js";
import type { SuggestState } from "./lib/suggestTypes";
import { suggestItemContent } from "./lib/suggestTypes";

export default function ComposerSuggestPopover(props: {
  onHover: (index: number) => void;
  onPick: (index: number) => void;
  ref: (el: HTMLDivElement) => void;
  state: SuggestState;
}) {
  return (
    <div class="menu-panel composer-suggest-popover" ref={props.ref}>
      <For each={props.state.items}>
        {(item, i) => (
          <button
            class="composer-suggest-row flex-align-center"
            classList={{ active: i() === props.state.active }}
            onClick={() => props.onPick(i())}
            onMouseEnter={() => props.onHover(i())}
            type="button"
          >
            {suggestItemContent(item)}
          </button>
        )}
      </For>
    </div>
  );
}
