import type { SearchResult } from "@slock/types";
import { createDebouncedRequest } from "@slock/ui";
import { createSignal } from "solid-js";
import { searchMessages } from "../../../../slack/client/api";
import { type SortMode, sortParams } from "../../searchQuery";

const SEARCH_DELAY_MS = 300;

export function createMessageSearch(onSearched: (query: string) => void) {
  const [state, setState] = createSignal<{
    error: boolean;
    loading: boolean;
    results: SearchResult[];
  }>({ error: false, loading: false, results: [] });
  let sortMode: SortMode = "relevant";
  const request = createDebouncedRequest((query) => searchMessages(query, sortParams(sortMode)), {
    delay: SEARCH_DELAY_MS,
    onError: () => setState((current) => ({ ...current, error: true })),
    onPendingChange: (loading) => setState((current) => ({ ...current, loading })),
    onReset: () => setState((current) => ({ ...current, error: false })),
    onResult: (results, query) => {
      setState((current) => ({ ...current, results }));
      onSearched(query);
    },
  });
  return {
    clear: () => setState((current) => ({ ...current, results: [] })),
    error: () => state().error,
    loading: () => state().loading,
    results: () => state().results,
    run(query: string, mode: SortMode, options?: { immediate?: boolean }) {
      sortMode = mode;
      request.run(query, options);
    },
  };
}
