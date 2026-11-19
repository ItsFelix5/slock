import { service } from "@slock/core/solid";
import type { SearchResult } from "@slock/types";
import { createDebouncedRequest } from "@slock/ui";
import { createSignal, onSettled } from "solid-js";
import { navigateToSlackPermalink } from "../../../message-links/client/api/slackPermalink";
import { searchMessages } from "../../../slack/client/api";
import { type SortMode, sortParams } from "../searchQuery";
import MessageSearchResults from "./MessageSearchResults";
import "./MessageSearchView.css";
import SearchQueryInput, { type SearchQueryInputHandle } from "./SearchQueryInput";

const sidebarStore = service("sidebar");
const searchStore = service("search");
const messageLinks = service("message-links");

export default function MessageSearchView() {
  let input: SearchQueryInputHandle | undefined;

  const [serializedQuery, setSerializedQuery] = createSignal("");
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [searchError, setSearchError] = createSignal(false);
  const [sortMode, setSortMode] = createSignal<SortMode>("relevant");

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
        searchStore.recordSearch(serializedQuery());
      },
    },
  );
  const runSearch = (immediate = true) => {
    searchStore.setScreenQuery(serializedQuery());
    searchRequest.run(serializedQuery(), { immediate });
  };
  const runHistorySearch = (q: string) => {
    input?.setQuery(q);
    runSearch();
  };
  const changeSort = (mode: SortMode) => {
    setSortMode(mode);
    if (canSearch()) runSearch();
  };
  const goToMessage = (r: SearchResult) => {
    navigateToSlackPermalink(
      { channelId: r.channelId, messageTs: r.ts, threadTs: r.threadTs ?? r.ts },
      messageLinks,
    );
  };
  const canSearch = () => !!serializedQuery().trim();

  onSettled(runSearch);

  return (
    <div class="message-search-view flex-col">
      <div class="message-search-header flex-align-center">
        <SearchQueryInput
          handle={(handle) => {
            input = handle;
          }}
          initial={searchStore.screenQuery()}
          onEscape={() => sidebarStore.setNavView("home")}
          onQuery={setSerializedQuery}
          onSubmit={runSearch}
          placeholder="Search every message…"
        />
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
