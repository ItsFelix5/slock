import {
  createDebouncedRequest,
  createListboxActiveIndex,
  FloatingPanel,
  Icon,
  SuggestionList,
} from "@slock/ui";
import { createMemo, createSignal, createUniqueId, onMount } from "solid-js";
import { fetchBrowsableChannels, type SearchResult, searchMessages } from "../../lib/api";
import { type SortMode, sortParams } from "../../lib/searchQuery";
import { store } from "../../lib/store";
import "./GlobalSearch.css";
import { createSearchQueryEditor } from "./lib/searchQueryEditor";
import { createTokenEntitySearch, mergeById } from "./lib/tokenEntitySearch";
import MessageSearchResults from "./MessageSearchResults";
import "./MessageSearchView.css";
import {
  activeViewSuggestionContext,
  type QuerySuggestion,
  querySuggestions,
  renderQuerySuggestion,
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
  const runSearch = (immediate = true) => {
    store.viewState.setSearchScreenQuery(serializedQuery());
    searchRequest.run(serializedQuery(), { immediate });
  };
  const runHistorySearch = (q: string) => {
    editor.setQueryText(q);
    runSearch();
  };
  const changeSort = (mode: SortMode) => {
    setSortMode(mode);
    if (canSearch()) runSearch();
  };
  const suggestionContext = activeViewSuggestionContext;
  const editor = createSearchQueryEditor({
    getActiveSuggestion: () => activeSuggestion(),
    getSuggestions: () => suggestions(),
    onEscapeWithNoSuggestions: () => store.viewState.setNavView("home"),
    onQueryChange: (query, nextCursor, typed) => {
      setSerializedQuery(query);
      setCursor(nextCursor);
      if (typed) setDismissedSuggestionsFor(undefined);
    },
    onSubmit: () => {
      setDismissedSuggestionsFor(serializedQuery());
      runSearch();
    },
    onSuggestionsShouldClose: () => setDismissedSuggestionsFor(serializedQuery()),
    setActiveSuggestion: (index) => setActiveSuggestion(index),
    suggestionsOpen: () => suggestionsOpen(),
  });

  const { remoteUsers, remoteChannels } = createTokenEntitySearch({
    cursor,
    query: () => editor.alignedText(),
    searchChannels: fetchBrowsableChannels,
    searchUsers: (term) => store.users.searchUsers(term),
  });
  const suggestions = createMemo<QuerySuggestion[]>(() =>
    querySuggestions(
      editor.alignedText(),
      cursor(),
      mergeById(store.users.knownUsers(), remoteUsers()),
      mergeById(store.resources.bootstrap.data?.channels ?? [], remoteChannels()),
      suggestionContext(),
    ).slice(0, 8),
  );
  const suggestionsOpen = createMemo(
    () => suggestions().length > 0 && dismissedSuggestionsFor() !== serializedQuery(),
  );
  const { activeIndex: activeSuggestion, setActiveIndex: setActiveSuggestion } =
    createListboxActiveIndex(
      () => suggestions().length,
      suggestionListId,
      () => suggestionsListRef,
    );

  onMount(() => {
    if (!containerEl) return;
    const quill = editor.mount(containerEl);
    quill.focus();
    editor.setQueryText(store.viewState.searchScreenQuery());
    runSearch();
  });
  const goToMessage = (r: SearchResult) => {
    navigateToSearchResult(r, store.viewState, { keepNav: true });
  };
  const canSearch = () => !!serializedQuery().trim();
  const optionId = (index: number) => `${suggestionListId}-option-${index}`;

  return (
    <div class="message-search-view">
      <div class="message-search-anchor">
        <div class="message-search-header flex-align-center">
          <Icon class="global-search-icon flex-shrink-0 text-dim" name="search" size={16} />
          <div class="ql-editor-root message-search-input" ref={containerEl} />
        </div>
        <FloatingPanel anchor={() => containerEl} open={suggestionsOpen()}>
          <SuggestionList
            activeIndex={activeSuggestion()}
            class="menu-panel message-search-suggestions"
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
            renderItem={renderQuerySuggestion}
          />
        </FloatingPanel>
      </div>
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
