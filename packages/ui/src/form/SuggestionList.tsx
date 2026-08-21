import type { JSX } from "solid-js";
import { For } from "solid-js";
import "./SuggestionList.css";

export interface SuggestionListProps<T> {
  activeIndex: number | null;
  ariaLabel?: string;
  class?: string;
  id?: string;
  items: T[];
  itemId?: (index: number) => string;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
  ref?: (el: HTMLDivElement) => void;
  renderItem: (item: T) => JSX.Element;
}

export default function SuggestionList<T>(props: SuggestionListProps<T>) {
  return (
    <div
      aria-label={props.ariaLabel}
      class={`suggestion-list${props.class ? ` ${props.class}` : ""}`}
      id={props.id}
      ref={props.ref}
      role="listbox"
    >
      <For each={props.items}>
        {(item, i) => (
          <button
            aria-selected={i() === props.activeIndex}
            class="suggestion-row btn-reset flex-align-center"
            classList={{ active: i() === props.activeIndex }}
            id={props.itemId?.(i())}
            onClick={() => props.onPick(i())}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => props.onHover(i())}
            role="option"
            type="button"
          >
            {props.renderItem(item)}
          </button>
        )}
      </For>
    </div>
  );
}
