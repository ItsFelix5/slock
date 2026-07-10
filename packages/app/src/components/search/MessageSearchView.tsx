import { Mrkdwn } from "@slock/blockkit";
import { type SearchResult, searchMessages } from "@slock/slack-api";
import { FilterCombobox, Icon } from "@slock/ui";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import {
  buildSearchQuery,
  EMPTY_FILTERS,
  hasActiveFilters,
  type SearchFilters,
  type SortMode,
  sortParams,
} from "../../lib/searchQuery";
import {
  bootstrap,
  currentUser,
  frecencyScore,
  knownUsers,
  openThread,
  searchScreenFilters,
  searchScreenQuery,
  searchUsers,
  setActiveView,
  setNavView,
  userById,
} from "../../lib/store";
import "./GlobalSearch.css";
import "./MessageSearchView.css";

const HAS_TOGGLES: { key: keyof SearchFilters; label: string }[] = [
  { key: "hasLink", label: "Has link" },
  { key: "hasStar", label: "Starred" },
  { key: "hasPin", label: "Pinned" },
  { key: "hasReaction", label: "Has reaction" },
  { key: "isThread", label: "In thread" },
  { key: "isSaved", label: "Saved" },
];

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "relevant", label: "Most relevant" },
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
];

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
      }
    }, 300);
  };

  onMount(() => {
    setQuery(searchScreenQuery());
    setFilters(searchScreenFilters());
    runSearch();
  });

  const patchFilters = (patch: Partial<SearchFilters>) => {
    setFilters({ ...filters(), ...patch });
    runSearch();
  };

  const channelItems = createMemo(() =>
    (bootstrap()?.channels ?? []).map((c) => ({
      id: c.id,
      label: `#${c.name}`,
      score: frecencyScore(c.id),
    })),
  );
  const userItems = createMemo(() =>
    knownUsers().map((u) => ({
      id: u.id,
      label: u.name,
      score: frecencyScore(u.id),
    })),
  );
  const remoteUserSearch = (q: string) =>
    searchUsers(q, currentUser()?.id).then((users) =>
      users.map((u) => ({ id: u.id, label: u.name, score: frecencyScore(u.id) })),
    );

  const goToMessage = (r: SearchResult) => {
    setActiveView({ kind: "channel", id: r.channelId });
    openThread(r.channelId, r.ts);
  };

  const canSearch = createMemo(() => !!query().trim() || filtersActive());

  return (
    <div class="message-search-view">
      <div class="message-search-header">
        <Icon name="search" size={16} class="global-search-icon" />
        <input
          class="global-search-input message-search-input"
          type="text"
          placeholder="Search every message…"
          value={query()}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            runSearch();
          }}
          autofocus
        />
        <button
          type="button"
          class="global-search-close"
          title="Close search"
          onClick={() => setNavView("home")}
        >
          ✕
        </button>
      </div>

      <div class="global-search-filters message-search-filters">
        <div class="global-search-filter-row">
          <span class="global-search-filter-label">From</span>
          <FilterCombobox
            placeholder="anyone"
            items={userItems()}
            value={filters().fromUserId}
            onSelect={(id) => patchFilters({ fromUserId: id })}
            remoteSearch={remoteUserSearch}
          />
          <span class="global-search-filter-label">In</span>
          <FilterCombobox
            placeholder="any channel"
            items={channelItems()}
            value={filters().inChannelId}
            onSelect={(id) => patchFilters({ inChannelId: id })}
          />
        </div>

        <div class="global-search-filter-row">
          <label class="global-search-filter-label" for="message-search-after">
            After
          </label>
          <input
            id="message-search-after"
            class="global-search-date"
            type="date"
            value={filters().after ?? ""}
            onInput={(e) => patchFilters({ after: e.currentTarget.value || undefined })}
          />
          <label class="global-search-filter-label" for="message-search-before">
            Before
          </label>
          <input
            id="message-search-before"
            class="global-search-date"
            type="date"
            value={filters().before ?? ""}
            onInput={(e) => patchFilters({ before: e.currentTarget.value || undefined })}
          />
        </div>

        <div class="global-search-filter-chips">
          <For each={HAS_TOGGLES}>
            {(t) => (
              <button
                type="button"
                class="global-search-chip"
                classList={{ active: !!filters()[t.key] }}
                onClick={() =>
                  patchFilters({
                    [t.key]: !filters()[t.key],
                  } as Partial<SearchFilters>)
                }
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
                  type="button"
                  class="global-search-sort-btn"
                  classList={{ active: sort() === o.key }}
                  onClick={() => {
                    setSort(o.key);
                    runSearch();
                  }}
                >
                  {o.label}
                </button>
              )}
            </For>
          </div>
          <Show when={filtersActive()}>
            <button
              type="button"
              class="global-search-clear-filters"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                runSearch();
              }}
            >
              Clear filters
            </button>
          </Show>
        </div>
      </div>

      <div class="message-search-results">
        <Show
          when={canSearch()}
          fallback={
            <div class="global-search-hint">
              Type something, or set filters, to search every message.
            </div>
          }
        >
          <Show
            when={!loading()}
            fallback={<div class="global-search-hint">Searching messages…</div>}
          >
            <Show
              when={results().length > 0}
              fallback={<div class="global-search-empty">No matches.</div>}
            >
              <For each={results()}>
                {(r) => {
                  const user = () => userById(r.userId);
                  return (
                    <button
                      type="button"
                      class="global-search-result message-search-result"
                      onClick={() => goToMessage(r)}
                    >
                      <div class="global-search-result-meta">
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
