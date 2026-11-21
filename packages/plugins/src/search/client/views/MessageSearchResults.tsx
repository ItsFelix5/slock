import { service } from "@slock/core/solid";
import type { SearchResult } from "@slock/types";
import {
  ariaBoolean,
  Button,
  findTextRanges,
  indexElementText,
  initRovingTabIndexDefault,
  isOneOf,
} from "@slock/ui";
import { createEffect, Errored, For, Loading, Show } from "solid-js";
import type { SortMode } from "../searchQuery";
import SearchHistoryList from "./SearchHistoryList";
import SearchResultRow from "./SearchResultRow";

const searchStore = service("search");

const SEARCH_TERM_HIGHLIGHT = "message-search-match";

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "relevant", label: "Most relevant" },
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
];

function ResultList(props: {
  container: () => HTMLElement | undefined;
  loading: boolean;
  onResult: (result: SearchResult) => void;
  results: SearchResult[];
}) {
  initRovingTabIndexDefault(props.container, () => props.results);

  createEffect(
    () => props.results,
    () => {
      const ranges: Range[] = [];
      for (const el of props.container()?.querySelectorAll<HTMLElement>("[data-search-terms]") ??
        []) {
        const terms: string[] = JSON.parse(el.dataset.searchTerms ?? "[]");
        if (terms.length === 0) continue;
        const index = indexElementText(el);
        for (const term of terms) ranges.push(...findTextRanges(index, term));
      }
      if (ranges.length > 0) CSS.highlights.set(SEARCH_TERM_HIGHLIGHT, new Highlight(...ranges));
      return () => CSS.highlights.delete(SEARCH_TERM_HIGHLIGHT);
    },
  );

  return (
    <Show
      fallback={
        <div class="message-search-empty empty-state">
          {props.loading ? "Searching messages…" : "No matches."}
        </div>
      }
      when={props.results.length > 0}
    >
      <For each={props.results}>
        {(result) => <SearchResultRow onOpen={props.onResult} result={result} />}
      </For>
    </Show>
  );
}

export default function MessageSearchResults(props: {
  canSearch: boolean;
  loading: boolean;
  onHistorySearch: (query: string) => void;
  onResult: (result: SearchResult) => void;
  onSortModeChange: (mode: SortMode) => void;
  results: SearchResult[];
  sortMode: SortMode;
}) {
  let containerRef: HTMLDivElement | undefined;

  return (
    <div aria-busy={ariaBoolean(props.loading)} class="message-search-results" ref={containerRef}>
      <Show
        fallback={
          <Show
            fallback={
              <div class="global-search-hint empty-state">
                Search every message, person, or conversation.
              </div>
            }
            when={searchStore.searchHistory().length > 0}
          >
            <SearchHistoryList onSearch={props.onHistorySearch} />
          </Show>
        }
        when={props.canSearch}
      >
        <div class="message-search-toolbar flex-align-center">
          <span class="global-search-filter-label">
            <Errored fallback={null}>
              <Loading fallback="Searching…">
                {props.loading
                  ? "Searching…"
                  : `${props.results.length} ${props.results.length === 1 ? "result" : "results"}`}
              </Loading>
            </Errored>
          </span>
          <select
            class="message-search-sort-select input-reset"
            onChange={(e) => {
              const { value } = e.currentTarget;
              const modes = SORT_OPTIONS.map((opt) => opt.key);
              if (isOneOf(value, modes)) props.onSortModeChange(value);
            }}
            value={props.sortMode}
          >
            <For each={SORT_OPTIONS}>{(opt) => <option value={opt.key}>{opt.label}</option>}</For>
          </select>
        </div>
        <Errored
          fallback={(_, reset) => (
            <div class="message-search-error flex-center empty-state">
              <span>Couldn't search messages.</span>
              <Button onClick={reset} size="sm">
                Try again
              </Button>
            </div>
          )}
        >
          <Loading fallback={<div class="global-search-hint empty-state">Searching messages…</div>}>
            <ResultList
              container={() => containerRef}
              loading={props.loading}
              onResult={props.onResult}
              results={props.results}
            />
          </Loading>
        </Errored>
      </Show>
    </div>
  );
}
