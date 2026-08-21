import { createLocalPref } from "../../localPref";

const MAX_ENTRIES = 15;

export function createSearchHistorySlice() {
  const [searchHistory, persist] = createLocalPref<string[]>("search-history", []);

  function recordSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    const deduped = [
      trimmed,
      ...searchHistory().filter((q) => q.toLowerCase() !== trimmed.toLowerCase()),
    ];
    persist(deduped.slice(0, MAX_ENTRIES));
  }

  function removeSearchHistoryEntry(query: string) {
    persist(searchHistory().filter((q) => q !== query));
  }

  function clearSearchHistory() {
    persist([]);
  }

  return {
    clearSearchHistory,
    recordSearch,
    removeSearchHistoryEntry,
    searchHistory,
  };
}
