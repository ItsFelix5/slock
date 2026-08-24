import { createDebouncedRequest, createListboxActiveIndex, Icon, SuggestionList } from "@slock/ui";
import type Quill from "quill";
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { fetchSearchAutocomplete, type SearchResult, searchMessages } from "../../lib/api";
import { type SortMode, sortParams } from "../../lib/searchQuery";
import { store } from "../../lib/store";
import "./GlobalSearch.css";
import { createSearchQueryEditor } from "./lib/searchQueryEditor";
import MessageSearchResults from "./MessageSearchResults";
import "./MessageSearchView.css";
import {
  type QuerySuggestion,
  type QuerySuggestionContext,
  querySuggestions,
} from "./querySuggestions";
import { navigateToSearchResult } from "./searchResultNavigation";

export default function MessageSearchView() {
  let containerEl: HTMLDivElement | undefined;
  let suggestionsListRef: HTMLDivElement | undefined;

  const [serializedQuery, setSerializedQuery] = createSignal("");
  const [cursor, setCursor] = createSignal(0);
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [searchError, setSearchError] = createSignal(false);
  const [remoteSuggestions, setRemoteSuggestions] = createSignal<string[]>([]);
  const [dismissedSuggestionsFor, setDismissedSuggestionsFor] = createSignal<string>();
  const [sortMode, setSortMode] = createSignal<SortMode>("relevant");
  const suggestionListId = createUniqueId();

  const searchRequest = createDebouncedRequest(
    (value) => searchMessages(value, sortParams(sortMode())),
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
        store.searchHistory.recordSearch(serializedQuery());
      },
    },
  );
  const autocompleteRequest = createDebouncedRequest(fetchSearchAutocomplete, {
    delay: 150,
    onReset: () => setRemoteSuggestions([]),
    onResult: setRemoteSuggestions,
  });
  const runSearch = (immediate = true) => {
    store.viewState.setSearchScreenQuery(serializedQuery());
    searchRequest.run(serializedQuery(), { immediate });
  };
  const runHistorySearch = (q: string) => {
    editor.setQueryText(q);
    autocompleteRequest.run("");
    runSearch();
  };
  const changeSort = (mode: SortMode) => {
    setSortMode(mode);
    if (canSearch()) runSearch();
  };
  const suggestionContext = createMemo<QuerySuggestionContext>(() => {
    const view = store.viewState.activeView();
    const currentUserId = store.users.currentUser()?.id;
    if (view?.kind === "channel") {
      const channel = store.channels.channelById(view.id);
      return {
        currentChannel: channel ? { id: channel.id, name: channel.name } : undefined,
        currentUserId,
      };
    }
    if (view?.kind === "dm") {
      const userId = store.dms.dmById(view.id)?.userId;
      const user = userId ? store.users.userById(userId) : undefined;
      return {
        currentDmUser: user ? { id: user.id, name: user.name } : undefined,
        currentUserId,
      };
    }
    return { currentUserId };
  });
  const editor = createSearchQueryEditor({
    getActiveSuggestion: () => activeSuggestion(),
    getSuggestions: () => suggestions(),
    onEscapeWithNoSuggestions: () => store.viewState.setNavView("home"),
    onQueryChange: (query, nextCursor, typed) => {
      setSerializedQuery(query);
      setCursor(nextCursor);
      if (typed) {
        setDismissedSuggestionsFor(undefined);
        autocompleteRequest.run(query);
      }
    },
    onSubmit: () => {
      setDismissedSuggestionsFor(serializedQuery());
      runSearch();
    },
    onSuggestionsShouldClose: () => setDismissedSuggestionsFor(serializedQuery()),
    setActiveSuggestion: (index) => setActiveSuggestion(index),
    suggestionsOpen: () => suggestionsOpen(),
  });

  const localSuggestions = createMemo<QuerySuggestion[]>(() =>
    querySuggestions(
      editor.alignedText(),
      cursor(),
      store.users.knownUsers(),
      store.resources.bootstrap()?.channels ?? [],
      suggestionContext(),
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
    () => suggestions().length > 0 && dismissedSuggestionsFor() !== serializedQuery(),
  );
  const { activeIndex: activeSuggestion, setActiveIndex: setActiveSuggestion } =
    createListboxActiveIndex(
      () => suggestions().length,
      suggestionListId,
      () => suggestionsListRef,
    );

  let quill: Quill | undefined;
  onMount(() => {
    if (!containerEl) return;
    quill = editor.mount(containerEl, suggestionListId);
    quill.focus();
    editor.setQueryText(store.viewState.searchScreenQuery());
    runSearch();
  });
  createEffect(() => {
    if (!quill) return;
    const active = activeSuggestion();
    editor.setSuggestionState(suggestionsOpen(), active === null ? null : optionId(active));
  });
  onCleanup(() => {
    searchRequest.dispose();
    autocompleteRequest.dispose();
  });
  const goToMessage = (r: SearchResult) => {
    navigateToSearchResult(r, store.viewState, { keepNav: true });
  };
  const canSearch = createMemo(() => !!serializedQuery().trim());
  const optionId = (index: number) => `${suggestionListId}-option-${index}`;

  return (
    <div class="message-search-view">
      <div class="message-search-header flex-align-center">
        <Icon class="global-search-icon flex-shrink-0 text-dim" name="search" size={16} />
        <div class="ql-editor-root message-search-input" ref={containerEl} />
      </div>
      <Show when={suggestionsOpen()}>
        <SuggestionList
          activeIndex={activeSuggestion()}
          ariaLabel="Search suggestions"
          class="message-search-suggestions"
          id={suggestionListId}
          itemId={optionId}
          items={suggestions()}
          onHover={setActiveSuggestion}
          onPick={(index) => {
            const suggestion = suggestions()[index];
            if (suggestion) editor.applySuggestion(suggestion);
          }}
          ref={(el) => {
            suggestionsListRef = el;
          }}
          renderItem={(suggestion) => (
            <>
              <Icon
                class="suggestion-icon flex-center"
                name={suggestion.replaceToken ? "filters" : "search"}
                size={13}
              />
              <span class="suggestion-label">{suggestion.label}</span>
              <Show when={suggestion.description}>
                <span class="suggestion-desc">{suggestion.description}</span>
              </Show>
            </>
          )}
        />
      </Show>
      <MessageSearchResults
        canSearch={canSearch()}
        loading={loading()}
        onHistorySearch={runHistorySearch}
        onResult={goToMessage}
        onRetry={runSearch}
        onSortModeChange={changeSort}
        results={results()}
        searchError={searchError()}
        sortMode={sortMode()}
      />
    </div>
  );
}
