import { Icon, type ListDirection, useListShortcuts } from "@slock/ui";

export default function GlobalSearchInput(props: {
  query: () => string;
  onQuery: (value: string) => void;
  onNavigateRows: (direction: ListDirection) => void;
  onSubmitRow: () => void;
}) {
  let inputRef: HTMLInputElement | undefined;

  useListShortcuts({
    move: props.onNavigateRows,
    root: () => inputRef,
    submit: props.onSubmitRow,
  });

  return (
    <div class="global-search-input-anchor">
      <div class="global-search-input-row flex-align-center">
        <Icon class="global-search-icon flex-shrink-0 text-dim" name="search" size={16} />
        <input
          autofocus
          autocomplete="off"
          class="global-search-input input-reset input-plain"
          onInput={(e) => props.onQuery(e.currentTarget.value)}
          placeholder="Search channels, people, conversations…"
          ref={inputRef}
          spellcheck={false}
          type="text"
          value={props.query()}
        />
      </div>
    </div>
  );
}
