import type { JSX } from "solid-js";
import { For } from "solid-js";
import "./SuggestionList.css";

export interface SuggestionListProps<T> {
  activeIndex: number | null;
  class?: string;
  id?: string;
  items: T[];
  itemId?: (index: number) => string;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
  ref?: (el: HTMLDivElement) => void;
  renderAction?: (item: T, index: number) => JSX.Element | null;
  renderItem: (item: T) => JSX.Element;
}

export default function SuggestionList<T>(props: SuggestionListProps<T>) {
  return (
    <div
      class={`suggestion-list${props.class ? ` ${props.class}` : ""}`}
      id={props.id}
      ref={props.ref}
    >
      <For each={props.items}>
        {(item, i) => {
          const row = (
            <button
              class="suggestion-row btn-reset flex-align-center"
              classList={{ active: i() === props.activeIndex }}
              id={props.itemId?.(i())}
              onClick={() => props.onPick(i())}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => props.onHover(i())}
              type="button"
            >
              {props.renderItem(item)}
            </button>
          );
          const action = props.renderAction?.(item, i());
          return action ? (
            <div class="suggestion-item" classList={{ active: i() === props.activeIndex }}>
              {row}
              {action}
            </div>
          ) : (
            row
          );
        }}
      </For>
    </div>
  );
}
