import { service } from "@slock/core/solid";
import { Button, Icon, IconButton } from "@slock/ui";
import { For } from "solid-js";
import { readableQuery } from "./lib/searchQueryEditor";

const searchStore = service("search");

export default function SearchHistoryList(props: { onSearch: (query: string) => void }) {
  return (
    <div class="message-search-history">
      <div class="message-search-history-header flex-align-center">
        <span class="global-search-filter-label">Recent searches</span>
        <Button
          class="message-search-history-clear"
          onClick={() => searchStore.clearSearchHistory()}
          size="sm"
        >
          Clear all
        </Button>
      </div>
      <For each={searchStore.searchHistory()}>
        {(query) => (
          <div class="message-search-history-item flex-align-center gap-xs">
            <button
              class="global-search-result message-search-history-query btn-reset flex-align-center grow"
              onClick={() => props.onSearch(query)}
              type="button"
            >
              <Icon class="global-search-jump-icon" name="search" size={13} />
              {readableQuery(query)}
            </button>
            <IconButton
              class="message-search-history-remove"
              icon="close"
              onClick={() => searchStore.removeSearchHistoryEntry(query)}
              size="sm"
              tone="dim"
            />
          </div>
        )}
      </For>
    </div>
  );
}
