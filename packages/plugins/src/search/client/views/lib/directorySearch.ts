import { searchGlobal } from "@slock/plugins/slack/client/api";
import type { GlobalSearchResults } from "@slock/types";
import { createDebouncedSearch } from "@slock/ui";

const EMPTY: GlobalSearchResults = { channels: [], files: [], users: [] };

const SEARCH_DELAY_MS = 100;

export function createDirectorySearch() {
  const search = createDebouncedSearch({
    delay: SEARCH_DELAY_MS,
    empty: EMPTY,
    search: searchGlobal,
  });
  return {
    error: search.failed,
    results: search.value,
    searching: search.searching,
    set: search.set,
  };
}
