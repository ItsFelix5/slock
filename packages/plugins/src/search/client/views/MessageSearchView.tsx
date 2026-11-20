import { service } from "@slock/core/solid";
import type { SearchResult } from "@slock/types";
import { createSignal, onSettled } from "solid-js";
import { navigateToSlackPermalink } from "../../../message-links/client/api/slackPermalink";
import type { SortMode } from "../searchQuery";
import { createMessageSearch } from "./lib/messageSearch";
import MessageSearchResults from "./MessageSearchResults";
import "./MessageSearchView.css";
import SearchQueryInput, { type SearchQueryInputHandle } from "./SearchQueryInput";

const sidebarStore = service("sidebar");
const searchStore = service("search");
const messageLinks = service("message-links");

export default function MessageSearchView() {
  let input: SearchQueryInputHandle | undefined;

  const [serializedQuery, setSerializedQuery] = createSignal("");
  const [sortMode, setSortMode] = createSignal<SortMode>("relevant");
  const search = createMessageSearch(searchStore.recordSearch);

  const runSearch = (query = serializedQuery(), mode = sortMode(), immediate = true) => {
    searchStore.setScreenQuery(query);
    if (!query.trim()) search.clear();
    search.run(query, mode, { immediate });
  };
  const runHistorySearch = (query: string) => {
    input?.setQuery(query);
    runSearch(query);
  };
  const changeSort = (mode: SortMode) => {
    setSortMode(mode);
    if (canSearch()) runSearch(serializedQuery(), mode);
  };
  const goToMessage = (r: SearchResult) => {
    navigateToSlackPermalink(
      { channelId: r.channelId, messageTs: r.ts, threadTs: r.threadTs ?? r.ts },
      messageLinks,
    );
  };
  const canSearch = () => !!serializedQuery().trim();

  onSettled(() => runSearch(searchStore.screenQuery()));

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
          onSubmit={() => runSearch()}
          placeholder="Search every message…"
        />
      </div>
      <MessageSearchResults
        canSearch={canSearch()}
        loading={search.loading()}
        onHistorySearch={runHistorySearch}
        onResult={goToMessage}
        onRetry={() => runSearch()}
        onSortModeChange={changeSort}
        results={search.results()}
        searchError={search.error()}
        sortMode={sortMode()}
      />
    </div>
  );
}
