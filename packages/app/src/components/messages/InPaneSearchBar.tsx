import { Icon, IconButton } from "@slock/ui";
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
          class="in-pane-search-input input-plain"
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
        <IconButton
          disabled={props.matchCount === 0}
          icon="caret-up"
          iconSize={14}
          label="Previous match"
          onClick={props.onPrev}
          size="sm"
        />
        <IconButton
          disabled={props.matchCount === 0}
          icon="caret-down"
          iconSize={14}
          label="Next match"
          onClick={props.onNext}
          size="sm"
        />
        <IconButton
          icon="close"
          iconSize={14}
          label="Close search"
          onClick={props.onClose}
          size="sm"
        />
      </div>
    </div>
  );
}
