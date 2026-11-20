import type { GlobalSearchResults } from "@slock/types";
import { createDebouncedRequest } from "@slock/ui";
import { createSignal } from "solid-js";
import { searchGlobal } from "../../../../slack/client/api";

const EMPTY: GlobalSearchResults = { channels: [], files: [], users: [] };

const SEARCH_DELAY_MS = 100;

export function createDirectorySearch() {
  const [state, setState] = createSignal({ error: false, results: EMPTY, searching: false });
  const request = createDebouncedRequest(searchGlobal, {
    delay: SEARCH_DELAY_MS,
    onError: () => setState((current) => ({ ...current, error: true })),
    onPendingChange: (searching) => setState((current) => ({ ...current, searching })),
    onReset: () => setState((current) => ({ ...current, error: false, results: EMPTY })),
    onResult: (results) => setState((current) => ({ ...current, results })),
  });
  return {
    error: () => state().error,
    results: () => state().results,
    run: request.run,
    searching: () => state().searching,
  };
}
