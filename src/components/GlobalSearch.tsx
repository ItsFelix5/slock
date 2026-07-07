import { For, Show, createMemo, createSignal } from 'solid-js';
import { searchMessages, type SearchResult } from '../slackApi';
import {
  bootstrap,
  directMessages,
  userById,
  searchUsers,
  setActiveView,
  openThread,
  openDmWithUser,
  currentUser,
} from '../store';
import type { Channel, User } from '../types';
import {
  buildSearchQuery,
  hasActiveFilters,
  sortParams,
  EMPTY_FILTERS,
  type SearchFilters,
  type SortMode,
} from '../searchQuery';
import Mrkdwn from '../blockkit/mrkdwn';
import Icon from '../icons';
import FilterCombobox from './FilterCombobox';
import { useEscapeClose } from '../useEscapeClose';
import './GlobalSearch.css';

const HAS_TOGGLES: { key: keyof SearchFilters; label: string }[] = [
  { key: 'hasLink', label: 'Has link' },
  { key: 'hasStar', label: 'Starred' },
  { key: 'hasPin', label: 'Pinned' },
  { key: 'hasReaction', label: 'Has reaction' },
  { key: 'isThread', label: 'In thread' },
  { key: 'isSaved', label: 'Saved' },
];

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'relevant', label: 'Most relevant' },
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
];

export default function GlobalSearch(props: { onClose: () => void }) {
  const [query, setQuery] = createSignal('');
  const [filters, setFilters] = createSignal<SearchFilters>(EMPTY_FILTERS);
  const [sort, setSort] = createSignal<SortMode>('relevant');
  const [showFilters, setShowFilters] = createSignal(false);
  const [messageResults, setMessageResults] = createSignal<SearchResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [remotePeople, setRemotePeople] = createSignal<User[]>([]);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let peopleDebounce: ReturnType<typeof setTimeout> | undefined;
  let peopleRequestId = 0;

  useEscapeClose(props.onClose);

  const filtersActive = createMemo(() => hasActiveFilters(filters()));

  // Run the message search whenever text, filters, or sort change. Channels and
  // people still match instantly from local data below.
  const runSearch = () => {
    clearTimeout(debounceTimer);
    const composed = buildSearchQuery(query(), filters());
    if (!composed.trim()) {
      setMessageResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceTimer = setTimeout(async () => {
      const { sort: s, sortDir } = sortParams(sort());
      const found = await searchMessages(composed, { sort: s, sortDir });
      setMessageResults(found);
      setLoading(false);
    }, 300);
  };

  const patchFilters = (patch: Partial<SearchFilters>) => {
    setFilters({ ...filters(), ...patch });
    runSearch();
  };

  const channelResults = createMemo<Channel[]>(() => {
    const q = query().trim().toLowerCase();
    if (!q || filtersActive()) return [];
    return (bootstrap()?.channels ?? []).filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  });

  const localPeopleMatches = createMemo<User[]>(() => {
    const q = query().trim().toLowerCase();
    if (!q || filtersActive()) return [];
    const me = currentUser()?.id;
    return (bootstrap()?.users ?? []).filter((u) => u.id !== me && u.name.toLowerCase().includes(q));
  });

  // The bootstrap user list is capped at 200 for payload size, which on a large
  // workspace covers a sliver of the org — merge in a debounced org-wide search
  // so "people" results aren't silently limited to whoever happened to load first.
  const peopleResults = createMemo<User[]>(() => {
    if (filtersActive() || !query().trim()) return [];
    const merged = new Map<string, User>();
    for (const u of localPeopleMatches()) merged.set(u.id, u);
    for (const u of remotePeople()) merged.set(u.id, u);
    return [...merged.values()].slice(0, 8);
  });

  const runPeopleSearch = () => {
    clearTimeout(peopleDebounce);
    const q = query().trim();
    if (!q || filtersActive()) {
      setRemotePeople([]);
      return;
    }
    const id = ++peopleRequestId;
    peopleDebounce = setTimeout(async () => {
      const found = await searchUsers(q, currentUser()?.id);
      if (id === peopleRequestId) setRemotePeople(found);
    }, 250);
  };

  const channelItems = createMemo(() =>
    (bootstrap()?.channels ?? []).map((c) => ({ id: c.id, label: `#${c.name}` })),
  );
  const userItems = createMemo(() => (bootstrap()?.users ?? []).map((u) => ({ id: u.id, label: u.name })));
  const remoteUserSearch = (q: string) =>
    searchUsers(q, currentUser()?.id).then((users) => users.map((u) => ({ id: u.id, label: u.name })));

  const goToMessage = (r: SearchResult) => {
    setActiveView({ kind: 'channel', id: r.channelId });
    openThread(r.channelId, r.ts);
    props.onClose();
  };

  const goToChannel = (id: string) => {
    setActiveView({ kind: 'channel', id });
    props.onClose();
  };

  const goToPerson = (userId: string) => {
    const dm = directMessages().find((d) => d.userId === userId);
    if (dm) setActiveView({ kind: 'dm', id: dm.id });
    else openDmWithUser(userId);
    props.onClose();
  };

  const hasAnyResult = createMemo(
    () => channelResults().length > 0 || peopleResults().length > 0 || messageResults().length > 0,
  );

  const canSearch = createMemo(() => !!buildSearchQuery(query(), filters()).trim());

  return (
    <div class="global-search-overlay" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class="global-search-card">
        <div class="global-search-input-row">
          <Icon name="search" size={16} class="global-search-icon" />
          <input
            class="global-search-input"
            type="text"
            placeholder="Search channels, people, messages…"
            value={query()}
            onInput={(e) => {
              setQuery(e.currentTarget.value);
              runSearch();
              runPeopleSearch();
            }}
            autofocus
          />
          <button
            class="global-search-filter-toggle"
            classList={{ active: showFilters() || filtersActive() }}
            title="Advanced filters"
            onClick={() => setShowFilters(!showFilters())}
          >
            Filters
          </button>
          <button class="global-search-close" onClick={props.onClose} title="Close">
            ✕
          </button>
        </div>

        <Show when={showFilters()}>
          <div class="global-search-filters">
            <div class="global-search-filter-row">
              <label class="global-search-filter-label">From</label>
              <FilterCombobox
                placeholder="anyone"
                items={userItems()}
                value={filters().fromUserId}
                onSelect={(id) => patchFilters({ fromUserId: id })}
                remoteSearch={remoteUserSearch}
              />
              <label class="global-search-filter-label">In</label>
              <FilterCombobox
                placeholder="any channel"
                items={channelItems()}
                value={filters().inChannelId}
                onSelect={(id) => patchFilters({ inChannelId: id })}
              />
            </div>

            <div class="global-search-filter-row">
              <label class="global-search-filter-label">After</label>
              <input
                class="global-search-date"
                type="date"
                value={filters().after ?? ''}
                onInput={(e) => patchFilters({ after: e.currentTarget.value || undefined })}
              />
              <label class="global-search-filter-label">Before</label>
              <input
                class="global-search-date"
                type="date"
                value={filters().before ?? ''}
                onInput={(e) => patchFilters({ before: e.currentTarget.value || undefined })}
              />
            </div>

            <div class="global-search-filter-chips">
              <For each={HAS_TOGGLES}>
                {(t) => (
                  <button
                    class="global-search-chip"
                    classList={{ active: !!filters()[t.key] }}
                    onClick={() => patchFilters({ [t.key]: !filters()[t.key] } as Partial<SearchFilters>)}
                  >
                    {t.label}
                  </button>
                )}
              </For>
            </div>

            <div class="global-search-filter-row">
              <label class="global-search-filter-label">Sort</label>
              <div class="global-search-sort">
                <For each={SORT_OPTIONS}>
                  {(o) => (
                    <button
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
        </Show>

        <div class="global-search-results">
          <Show
            when={canSearch()}
            fallback={<div class="global-search-hint">Jump to a channel or person, or search every message. (Ctrl+K)</div>}
          >
            <Show when={hasAnyResult() || loading()} fallback={<div class="global-search-empty">No matches.</div>}>
              <Show when={channelResults().length > 0}>
                <div class="global-search-section">Channels</div>
                <For each={channelResults()}>
                  {(c) => (
                    <button class="global-search-result global-search-jump" onClick={() => goToChannel(c.id)}>
                      <span class="global-search-jump-icon">{c.private ? <Icon name="lock" size={13} /> : '#'}</span>
                      {c.name}
                    </button>
                  )}
                </For>
              </Show>

              <Show when={peopleResults().length > 0}>
                <div class="global-search-section">People</div>
                <For each={peopleResults()}>
                  {(u) => (
                    <button class="global-search-result global-search-jump" onClick={() => goToPerson(u.id)}>
                      <span class="global-search-avatar" style={{ background: u.avatarColor }}>
                        <Show when={u.avatarUrl} fallback={u.initials}>
                          {(url) => <img src={url()} alt="" />}
                        </Show>
                      </span>
                      {u.name}
                    </button>
                  )}
                </For>
              </Show>

              <Show when={loading() || messageResults().length > 0}>
                <div class="global-search-section">Messages</div>
                <Show when={!loading()} fallback={<div class="global-search-hint">Searching messages…</div>}>
                  <For each={messageResults()}>
                    {(r) => {
                      const user = () => userById(r.userId);
                      return (
                        <button class="global-search-result" onClick={() => goToMessage(r)}>
                          <div class="global-search-result-meta">
                            {user()?.name ?? 'Someone'} in #{r.channelName ?? r.channelId}
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
          </Show>
        </div>
      </div>
    </div>
  );
}
