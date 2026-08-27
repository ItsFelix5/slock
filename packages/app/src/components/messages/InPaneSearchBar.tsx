import { Icon, Tooltip } from "@slock/ui";
import { onMount, Show } from "solid-js";
import "./InPaneSearchBar.css";

export default function InPaneSearchBar(props: {
  query: string;
  onQueryInput: (value: string) => void;
  matchCount: number;
  matchIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  let inputRef: HTMLInputElement | undefined;
  onMount(() => inputRef?.focus());

  return (
    <div class="in-pane-search-anchor">
      <div class="in-pane-search flex-align-center">
        <Icon class="text-dim flex-shrink-0" name="search" size={14} />
        <input
          aria-label="Search in this view"
          class="in-pane-search-input"
          onInput={(e) => props.onQueryInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (e.shiftKey) props.onPrev();
            else props.onNext();
          }}
          placeholder="Search in this view…"
          ref={inputRef}
          value={props.query}
        />
        <Show when={props.query}>
          <span class="in-pane-search-count text-dim">
            {props.matchCount > 0 ? `${props.matchIndex + 1}/${props.matchCount}` : "0/0"}
          </span>
        </Show>
        <Tooltip content="Previous match">
          <button
            aria-label="Previous match"
            class="btn-reset flex-center"
            disabled={props.matchCount === 0}
            onClick={props.onPrev}
            type="button"
          >
            <Icon name="caret-up" size={14} />
          </button>
        </Tooltip>
        <Tooltip content="Next match">
          <button
            aria-label="Next match"
            class="btn-reset flex-center"
            disabled={props.matchCount === 0}
            onClick={props.onNext}
            type="button"
          >
            <Icon name="caret-down" size={14} />
          </button>
        </Tooltip>
        <Tooltip content="Close search">
          <button
            aria-label="Close search"
            class="btn-reset flex-center"
            onClick={props.onClose}
            type="button"
          >
            <Icon name="close" size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
