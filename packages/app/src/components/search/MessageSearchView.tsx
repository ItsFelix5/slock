import { Mrkdwn } from "@slock/blockkit";
import { type SearchResult, searchMessages } from "@slock/slack-api";
import { FilterCombobox, Icon, Tooltip } from "@slock/ui";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import {
  buildSearchQuery,
  EMPTY_FILTERS,
  hasActiveFilters,
  type SearchFilters,
  type SortMode,
  sortParams,
} from "../../lib/searchQuery";
import { store } from "../../lib/store";
import "./GlobalSearch.css";
import "./MessageSearchView.css";
import { HAS_TOGGLES, SORT_OPTIONS } from "./messageSearchOptions";
export default function MessageSearchView() {
  const [query, setQuery] = createSignal("");
  const [filters, setFilters] = createSignal<SearchFilters>(EMPTY_FILTERS);
  const [sort, setSort] = createSignal<SortMode>("relevant");
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;
  const filtersActive = createMemo(() => hasActiveFilters(filters()));
  const runSearch = () => {
    clearTimeout(debounceTimer);
    const composed = buildSearchQuery(query(), filters());
    if (!composed.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId;
    debounceTimer = setTimeout(async () => {
      const { sort: s, sortDir } = sortParams(sort());
      const found = await searchMessages(composed, { sort: s, sortDir });
      if (id === requestId) {
        setResults(found);
        setLoading(false);
        store.searchHistory.recordSearch(query());
      }
    }, 300);
  };
  const runHistorySearch = (q: string) => {
    setQuery(q);
    runSearch();
  };
  onMount(() => {
    setQuery(store.viewState.searchScreenQuery());
    setFilters(store.viewState.searchScreenFilters());
    runSearch();
  });
  onCleanup(() => clearTimeout(debounceTimer));
  const patchFilters = (patch: Partial<SearchFilters>) => {
    setFilters({ ...filters(), ...patch });
    runSearch();
  };
  const channelItems = createMemo(() =>
    (store.resources.bootstrap()?.channels ?? []).map((c) => ({
      id: c.id,
      label: `#${c.name}`,
      score: store.preferences.frecencyScore(c.id),
    })),
  );
  const userItems = createMemo(() =>
    store.users.knownUsers().map((u) => ({
      id: u.id,
      label: u.name,
      score: store.preferences.frecencyScore(u.id),
    })),
  );
  const remoteUserSearch = (q: string) =>
    store.users.searchUsers(q, store.users.currentUser()?.id).then((users) =>
      users.map((u) => ({
        id: u.id,
        label: u.name,
        score: store.preferences.frecencyScore(u.id),
      })),
    );
  const goToMessage = (r: SearchResult) => {
    store.viewState.setActiveView({ id: r.channelId, kind: "channel" });
    store.viewState.openThread(r.channelId, r.ts);
  };
  const canSearch = createMemo(() => !!query().trim() || filtersActive());
  return (
    <div class="message-search-view">
      <div class="message-search-header flex-align-center">
        <Icon class="global-search-icon flex-shrink-0 text-dim" name="search" size={16} />
        <input
          autofocus
          class="global-search-input message-search-input input-reset"
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            runSearch();
          }}
          placeholder="Search every message…"
          type="text"
          value={query()}
        />
        <Tooltip content="Close search">
          <button
            aria-label="Close search"
            class="panel-close-btn"
            onClick={() => store.viewState.setNavView("home")}
            type="button"
          >
            <Icon name="close" size={12} />
          </button>
        </Tooltip>
      </div>
      <div class="global-search-filters message-search-filters">
        <div class="global-search-filter-row">
          <span class="global-search-filter-label">From</span>
          <FilterCombobox
            items={userItems()}
            onSelect={(id) => patchFilters({ fromUserId: id })}
            placeholder="anyone"
            remoteSearch={remoteUserSearch}
            value={filters().fromUserId}
          />
          <span class="global-search-filter-label">In</span>
          <FilterCombobox
            items={channelItems()}
            onSelect={(id) => patchFilters({ inChannelId: id })}
            placeholder="any channel"
            value={filters().inChannelId}
          />
        </div>
        <div class="global-search-filter-row">
          <label class="global-search-filter-label" for="message-search-after">
            After
          </label>
          <input
            class="global-search-date"
            id="message-search-after"
            onInput={(e) => patchFilters({ after: e.currentTarget.value || undefined })}
            type="date"
            value={filters().after ?? ""}
          />
          <label class="global-search-filter-label" for="message-search-before">
            Before
          </label>
          <input
            class="global-search-date"
            id="message-search-before"
            onInput={(e) => patchFilters({ before: e.currentTarget.value || undefined })}
            type="date"
            value={filters().before ?? ""}
          />
        </div>
        <div class="global-search-filter-chips">
          <For each={HAS_TOGGLES}>
            {(t) => (
              <button
                class="global-search-chip"
                classList={{ active: !!filters()[t.key] }}
                onClick={() =>
                  patchFilters({
                    [t.key]: !filters()[t.key],
                  } as Partial<SearchFilters>)
                }
                type="button"
              >
                {t.label}
              </button>
            )}
          </For>
        </div>
        <div class="global-search-filter-row">
          <span class="global-search-filter-label">Sort</span>
          <div class="global-search-sort">
            <For each={SORT_OPTIONS}>
              {(o) => (
                <button
                  class="global-search-sort-btn btn-reset"
                  classList={{ active: sort() === o.key }}
                  onClick={() => {
                    setSort(o.key);
                    runSearch();
                  }}
                  type="button"
                >
                  {o.label}
                </button>
              )}
            </For>
          </div>
          <Show when={filtersActive()}>
            <button
              class="global-search-clear-filters btn-reset"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                runSearch();
              }}
              type="button"
            >
              Clear filters
            </button>
          </Show>
        </div>
      </div>
      <div class="message-search-results">
        <Show
          fallback={
            <Show
              fallback={
                <div class="global-search-hint empty-state">
                  Type something, or set filters, to search every message.
                </div>
              }
              when={store.searchHistory.searchHistory().length > 0}
            >
              <div class="message-search-history">
                <div class="message-search-history-header">
                  <span class="global-search-filter-label">Recent searches</span>
                  <button
                    class="global-search-clear-filters btn-reset"
                    onClick={store.searchHistory.clearSearchHistory}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
                <For each={store.searchHistory.searchHistory()}>
                  {(q) => (
                    <div class="message-search-history-item">
                      <button
                        class="global-search-result message-search-history-query btn-reset flex-align-center"
                        onClick={() => runHistorySearch(q)}
                        type="button"
                      >
                        <Icon class="global-search-jump-icon" name="search" size={13} />
                        {q}
                      </button>
                      <Tooltip content="Remove">
                        <button
                          aria-label="Remove"
                          class="message-search-history-remove btn-reset icon-btn icon-action text-dim"
                          onClick={() => store.searchHistory.removeSearchHistoryEntry(q)}
                          type="button"
                        >
                          <Icon name="close" size={12} />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          }
          when={canSearch()}
        >
          <Show
            fallback={<div class="global-search-hint empty-state">Searching messages…</div>}
            when={!loading()}
          >
            <Show
              fallback={<div class="global-search-empty empty-state">No matches.</div>}
              when={results().length > 0}
            >
              <For each={results()}>
                {(r) => {
                  const user = () => store.users.userById(r.userId);
                  return (
                    <button
                      class="global-search-result message-search-result btn-reset"
                      onClick={() => goToMessage(r)}
                      type="button"
                    >
                      <div class="global-search-result-meta text-muted text-sm">
                        {user()?.name ?? "Someone"} in #{r.channelName ?? r.channelId}
                      </div>
                      <div class="global-search-result-snippet">
                        <Mrkdwn text={r.text} />
                      </div>
                    </button>
                  );
                }}
              </For>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
}
