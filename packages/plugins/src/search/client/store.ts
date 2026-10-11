import { createSignal } from "solid-js";
import { saveSearchHistory } from "../../slack/client/api";
import { createLocalPref } from "../../slack/client/api/localPref";
import { buildSearchQuery, EMPTY_FILTERS, type SearchFilters } from "./searchQuery";

const MAX_ENTRIES = 15;

export function createSearchStore(deps: { showScreen: () => void }) {
  const [searchHistory, persist] = createLocalPref<string[]>("search-history", []);
  const [screenQuery, setScreenQuery] = createSignal("");

  function recordSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    const deduped = [
      trimmed,
      ...searchHistory().filter((q) => q.toLowerCase() !== trimmed.toLowerCase()),
    ];
    persist(deduped.slice(0, MAX_ENTRIES));
    saveSearchHistory(trimmed);
  }

  function removeSearchHistoryEntry(query: string) {
    persist(searchHistory().filter((q) => q !== query));
  }

  function clearSearchHistory() {
    persist([]);
  }

  function openSearch(query: string, filters: SearchFilters = EMPTY_FILTERS) {
    setScreenQuery(buildSearchQuery(query, filters));
    deps.showScreen();
  }

  return {
    clearSearchHistory,
    openSearch,
    recordSearch,
    removeSearchHistoryEntry,
    screenQuery,
    searchHistory,
    setScreenQuery,
  };
}
