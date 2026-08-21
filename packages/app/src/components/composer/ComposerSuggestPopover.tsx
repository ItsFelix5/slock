import { SuggestionList } from "@slock/ui";
import type { SuggestState } from "./lib/suggestTypes";
import { suggestItemContent } from "./lib/suggestTypes";

export default function ComposerSuggestPopover(props: {
  onHover: (index: number) => void;
  onPick: (index: number) => void;
  ref: (el: HTMLDivElement) => void;
  state: SuggestState;
}) {
  return (
    <SuggestionList
      activeIndex={props.state.active}
      class="menu-panel composer-suggest-popover"
      items={props.state.items}
      onHover={props.onHover}
      onPick={props.onPick}
      ref={props.ref}
      renderItem={suggestItemContent}
    />
  );
}
