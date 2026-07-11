import type { UserPrefs } from "@slock/slack-api";
import { setSearchHistory as setSearchHistoryApi } from "@slock/slack-api";
import { createEffect, createSignal } from "solid-js";

const MAX_ENTRIES = 15;

// Recent message-search queries, synced through the same users.prefs blob as
// pingwords/mute (custom key — see fetchUserPrefs) rather than localStorage,
// so history follows the account across devices instead of staying per-browser.
export function createSearchHistorySlice(deps: { userPrefs: () => UserPrefs | undefined }) {
  const [searchHistory, setSearchHistory] = createSignal<string[]>([]);

  let seeded = false;
  createEffect(() => {
    const prefs = deps.userPrefs();
    if (!prefs || seeded) return;
    seeded = true;
    setSearchHistory(prefs.searchHistory);
  });

  function persist(next: string[]) {
    setSearchHistory(next);
    setSearchHistoryApi(next).catch((err) => {
      console.error("Failed to sync search history", err);
    });
  }

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

  return { searchHistory, recordSearch, removeSearchHistoryEntry, clearSearchHistory };
}
