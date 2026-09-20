import { Icon } from "@slock/ui";

export default function GlobalSearchInput(props: {
  query: () => string;
  hasQuery: () => boolean;
  onQuery: (value: string) => void;
  onNavigateRows: (key: "ArrowDown" | "ArrowUp" | "Home" | "End") => void;
  onSubmitRow: () => void;
}) {
  return (
    <div class="global-search-input-anchor">
      <div class="global-search-input-row flex-align-center">
        <Icon class="global-search-icon flex-shrink-0 text-dim" name="search" size={16} />
        <input
          autofocus
          autocomplete="off"
          class="global-search-input input-reset input-plain"
          onInput={(e) => props.onQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              props.onNavigateRows(e.key);
            } else if ((e.key === "Home" || e.key === "End") && props.hasQuery()) {
              e.preventDefault();
              props.onNavigateRows(e.key);
            } else if (e.key === "Enter" && props.hasQuery()) {
              e.preventDefault();
              props.onSubmitRow();
            }
          }}
          placeholder="Search channels, people, conversations…"
          spellcheck={false}
          type="text"
          value={props.query()}
        />
      </div>
    </div>
  );
}
