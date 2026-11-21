import type { SearchResult } from "@slock/types";
import { affects, createMemo, createSignal, isPending, onCleanup, refresh } from "solid-js";
import { searchMessages } from "../../../../slack/client/api";
import { type SortMode, sortParams } from "../../searchQuery";

const NONE: SearchResult[] = [];

export function createMessageSearch(sortMode: () => SortMode, onSearched: (query: string) => void) {
  const [query, setQuery] = createSignal("");
  const results = createMemo(() => {
    const text = query();
    if (!text) return NONE;
    const params = sortParams(sortMode());
    let superseded = false;
    onCleanup(() => {
      superseded = true;
    });
    return searchMessages(text, params).then((found) => {
      if (!superseded) onSearched(text);
      return found;
    });
  });
  return {
    loading: () => isPending(results),
    results,
    search(raw: string) {
      const text = raw.trim();
      if (text === query()) {
        affects(results);
        refresh(results);
      } else setQuery(text);
    },
  };
}
