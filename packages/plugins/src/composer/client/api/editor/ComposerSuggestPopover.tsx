import { SuggestionList } from "@slock/ui";
import type { SuggestState } from "./suggestTypes";
import { suggestItemContent } from "./suggestTypes";

export default function ComposerSuggestPopover(props: {
  floating?: boolean;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
  ref: (el: HTMLDivElement) => void;
  state: SuggestState;
}) {
  return (
    <div
      class={`menu-panel composer-suggest-popover${props.floating ? "" : " composer-suggest-docked"}`}
      ref={props.ref}
    >
      <SuggestionList
        activeIndex={props.state.active}
        class="composer-suggest-scroll"
        items={props.state.items}
        onHover={props.onHover}
        onPick={props.onPick}
        renderItem={suggestItemContent}
      />
    </div>
  );
}
