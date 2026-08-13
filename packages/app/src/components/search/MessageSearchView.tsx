import { fetchSearchAutocomplete, searchMessages, type SearchResult } from "@slock/slack-api";
import {
  createDebouncedRequest,
  createListboxActiveIndex,
  Icon,
  listNavigationIndex,
} from "@slock/ui";
import { createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show } from "solid-js";
import { store } from "../../lib/store";
import "./GlobalSearch.css";
import MessageSearchResults from "./MessageSearchResults";
import "./MessageSearchView.css";
import { type QuerySuggestion, querySuggestions, queryToken } from "./querySuggestions";
import { navigateToSearchResult } from "./searchResultNavigation";

export default function MessageSearchView() {
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [searchError, setSearchError] = createSignal(false);
  const [remoteSuggestions, setRemoteSuggestions] = createSignal<string[]>([]);
  const [cursor, setCursor] = createSignal(0);
  const [dismissedSuggestionsFor, setDismissedSuggestionsFor] = createSignal<string>();
  const suggestionListId = createUniqueId();

  let suggestionsListRef: HTMLDivElement | undefined;
  const searchRequest = createDebouncedRequest(
    (value) => searchMessages(value, { sort: "score", sortDir: "desc" }),
    {
      delay: 300,
      onError: () => setSearchError(true),
      onPendingChange: setLoading,
      onReset: () => {
        setSearchError(false);
        if (!canSearch()) setResults([]);
      },
      onResult: (found) => {
        setResults(found);
        store.searchHistory.recordSearch(query());
      },
    },
  );
  const autocompleteRequest = createDebouncedRequest(fetchSearchAutocomplete, {
    delay: 150,
    onReset: () => setRemoteSuggestions([]),
    onResult: setRemoteSuggestions,
  });
  const updateQuery = (value: string, selectionStart = value.length) => {
    setQuery(value);
    setCursor(selectionStart);
    setDismissedSuggestionsFor(undefined);
    store.viewState.setSearchScreenQuery(value);
  };
  const runSearch = () => {
    searchRequest.run(query());
  };
  const runAutocomplete = () => {
    autocompleteRequest.run(query());
  };
  const runHistorySearch = (q: string) => {
    updateQuery(q);
    autocompleteRequest.run("");
    runSearch();
  };
  const localSuggestions = createMemo<QuerySuggestion[]>(() =>
    querySuggestions(
      query(),
      cursor(),
      store.users.knownUsers(),
      store.resources.bootstrap()?.channels ?? [],
    ),
  );
  const suggestions = createMemo<QuerySuggestion[]>(() => {
    const local = localSuggestions();
    const localValues = new Set(local.map((item) => item.value));
    return [
      ...local,
      ...remoteSuggestions()
        .filter((value) => !localValues.has(value))
        .map((value) => ({ id: `remote-${value}`, label: value, value })),
    ].slice(0, 8);
  });
  const suggestionsOpen = createMemo(
    () => suggestions().length > 0 && dismissedSuggestionsFor() !== query(),
  );
  const { activeIndex: activeSuggestion, setActiveIndex: setActiveSuggestion } =
    createListboxActiveIndex(
      () => suggestions().length,
      suggestionListId,
      () => suggestionsListRef,
    );
  const applySuggestion = (suggestion: QuerySuggestion) => {
    const current = query();
    const selection = cursor();
    const token = queryToken(current, selection);
    const complete = !suggestion.value.endsWith(":");
    const next = suggestion.replaceToken
      ? `${current.slice(0, token.start)}${suggestion.value}${complete ? " " : ""}${current.slice(token.end)}`
      : suggestion.value;
    const nextCursor = suggestion.replaceToken
      ? token.start + suggestion.value.length + (complete ? 1 : 0)
      : next.length;
    updateQuery(next, nextCursor);
    autocompleteRequest.run(next);
    runSearch();
  };
  onMount(() => {
    const initialQuery = store.viewState.searchScreenQuery();
    updateQuery(initialQuery);
    runSearch();
  });
  onCleanup(() => {
    searchRequest.dispose();
    autocompleteRequest.dispose();
  });
  const goToMessage = (r: SearchResult) => {
    navigateToSearchResult(r, store.viewState);
  };
  const canSearch = createMemo(() => !!query().trim());
  const optionId = (index: number) => `${suggestionListId}-option-${index}`;
  const activeSuggestionId = () => {
    const active = activeSuggestion();
    return suggestionsOpen() && active !== null ? optionId(active) : undefined;
  };
  const moveSuggestion = (key: string) => {
    const next = listNavigationIndex(key, activeSuggestion(), suggestions().length);
    if (next !== undefined) setActiveSuggestion(next);
  };
  return (
    <div class="message-search-view">
      <div class="message-search-header flex-align-center">
        <Icon class="global-search-icon flex-shrink-0 text-dim" name="search" size={16} />
        <input
          autofocus
          aria-activedescendant={activeSuggestionId()}
          aria-autocomplete="list"
          aria-controls={suggestionListId}
          aria-expanded={suggestionsOpen()}
          aria-label="Search every message"
          autocomplete="off"
          class="global-search-input message-search-input input-reset"
          onInput={(e) => {
            updateQuery(
              e.currentTarget.value,
              e.currentTarget.selectionStart ?? e.currentTarget.value.length,
            );
            runSearch();
            runAutocomplete();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && suggestionsOpen()) {
              e.preventDefault();
              moveSuggestion(e.key);
            } else if (e.key === "ArrowUp" && suggestionsOpen()) {
              e.preventDefault();
              moveSuggestion(e.key);
            } else if (e.key === "Tab" && suggestionsOpen()) {
              const selected = activeSuggestion();
              const suggestion = selected === null ? undefined : suggestions()[selected];
              if (!suggestion || e.isComposing) return;
              e.preventDefault();
              applySuggestion(suggestion);
            } else if (e.key === "Enter" && !e.isComposing) {
              e.preventDefault();
              setDismissedSuggestionsFor(query());
              runSearch();
            } else if (e.key === "Escape") {
              if (suggestionsOpen()) {
                e.preventDefault();
                setDismissedSuggestionsFor(query());
              } else {
                store.viewState.setNavView("home");
              }
            }
          }}
          onKeyUp={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              setCursor(e.currentTarget.selectionStart ?? e.currentTarget.value.length);
            }
          }}
          placeholder="Search every message…"
          spellcheck={false}
          type="text"
          value={query()}
        />
        <span class="message-search-keyhint">esc</span>
      </div>
      <Show when={suggestionsOpen()}>
        <div
          aria-label="Search suggestions"
          class="message-search-suggestions"
          id={suggestionListId}
          ref={suggestionsListRef}
        >
          <For each={suggestions()}>
            {(suggestion, index) => (
              <button
                aria-selected={activeSuggestion() === index()}
                class="message-search-suggestion btn-reset"
                classList={{ active: activeSuggestion() === index() }}
                id={optionId(index())}
                onClick={() => applySuggestion(suggestion)}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveSuggestion(index())}
                tabIndex={-1}
                type="button"
              >
                <Icon
                  class="text-dim"
                  name={suggestion.replaceToken ? "filters" : "search"}
                  size={13}
                />
                <span>{suggestion.label}</span>
                <Show when={suggestion.description}>
                  <span class="message-search-suggestion-description">
                    {suggestion.description}
                  </span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
      <MessageSearchResults
        canSearch={canSearch()}
        loading={loading()}
        onHistorySearch={runHistorySearch}
        onResult={goToMessage}
        onRetry={runSearch}
        results={results()}
        searchError={searchError()}
      />
    </div>
  );
}
