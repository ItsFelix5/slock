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
import { createEffect, For, onCleanup, Show } from "solid-js";
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

export default function MessageSearchResults(props: {
  canSearch: boolean;
  loading: boolean;
  onHistorySearch: (query: string) => void;
  onResult: (result: SearchResult) => void;
  onRetry: () => void;
  onSortModeChange: (mode: SortMode) => void;
  results: SearchResult[];
  searchError: boolean;
  sortMode: SortMode;
}) {
  let containerRef: HTMLDivElement | undefined;
  initRovingTabIndexDefault(
    () => containerRef,
    () => props.results,
  );

  createEffect(
    () => props.results,
    () => {
      const container = containerRef;
      const ranges: Range[] = [];
      if (container) {
        for (const el of container.querySelectorAll<HTMLElement>("[data-search-terms]")) {
          const terms: string[] = JSON.parse(el.dataset.searchTerms ?? "[]");
          if (terms.length === 0) continue;
          const index = indexElementText(el);
          for (const term of terms) ranges.push(...findTextRanges(index, term));
        }
      }
      if (ranges.length > 0) CSS.highlights.set(SEARCH_TERM_HIGHLIGHT, new Highlight(...ranges));
      else CSS.highlights.delete(SEARCH_TERM_HIGHLIGHT);
    },
  );
  onCleanup(() => CSS.highlights.delete(SEARCH_TERM_HIGHLIGHT));

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
            {props.loading
              ? "Searching…"
              : `${props.results.length} ${props.results.length === 1 ? "result" : "results"}`}
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
        <Show
          fallback={<div class="global-search-hint empty-state">Searching messages…</div>}
          when={!props.loading || props.results.length > 0}
        >
          <Show
            fallback={
              <div class="message-search-error flex-center empty-state">
                <span>Couldn't search messages.</span>
                <Button onClick={props.onRetry} size="sm">
                  Try again
                </Button>
              </div>
            }
            when={!props.searchError}
          >
            <Show
              fallback={<div class="message-search-empty empty-state">No matches.</div>}
              when={props.results.length > 0}
            >
              <For each={props.results}>
                {(result) => <SearchResultRow onOpen={props.onResult} result={result} />}
              </For>
            </Show>
          </Show>
        </Show>
      </Show>
    </div>
  );
}
