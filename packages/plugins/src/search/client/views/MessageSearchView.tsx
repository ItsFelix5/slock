import { service } from "@slock/core/solid";
import type { SearchResult } from "@slock/types";
import {
  createDebouncedRequest,
  createListboxActiveIndex,
  FloatingPanel,
  Icon,
  SuggestionList,
} from "@slock/ui";
import { createMemo, createSignal, createUniqueId, onMount } from "solid-js";
import { navigateToSlackPermalink } from "../../../message-links/client/api/slackPermalink";
import { fetchBrowsableChannels, searchMessages } from "../../../slack/client/api";
import { type SortMode, sortParams } from "../searchQuery";
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

const sidebarStore = service("sidebar");
const searchStore = service("search");

const bootstrapStore = service("bootstrap");
const messageLinks = service("message-links");
const usersStore = service("users");

const searchHistory = service("search");

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
        searchHistory.recordSearch(serializedQuery());
      },
    },
  );
  const runSearch = (immediate = true) => {
    searchStore.setScreenQuery(serializedQuery());
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
    onEscapeWithNoSuggestions: () => sidebarStore.setNavView("home"),
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
    searchUsers: (term) => usersStore.searchUsers(term),
  });
  const suggestions = createMemo<QuerySuggestion[]>(() =>
    querySuggestions(
      editor.alignedText(),
      cursor(),
      mergeById(usersStore.knownUsers(), remoteUsers()),
      mergeById(bootstrapStore.bootstrap.data?.channels ?? [], remoteChannels()),
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
    editor.setQueryText(searchStore.screenQuery());
    runSearch();
  });
  const goToMessage = (r: SearchResult) => {
    navigateToSlackPermalink(
      { channelId: r.channelId, messageTs: r.ts, threadTs: r.threadTs ?? r.ts },
      messageLinks,
    );
  };
  const canSearch = () => !!serializedQuery().trim();
  const optionId = (index: number) => `${suggestionListId}-option-${index}`;

  return (
    <div class="message-search-view flex-col">
      <div class="message-search-anchor">
        <div class="message-search-header flex-align-center">
          <Icon class="global-search-icon flex-shrink-0 text-dim" name="search" size={16} />
          <div class="ql-editor-root message-search-input grow" ref={containerEl} />
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
