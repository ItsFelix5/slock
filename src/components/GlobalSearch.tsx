import { For, Show, createMemo, createSignal } from 'solid-js';
import {
  bootstrap,
  directMessages,
  searchUsers,
  setActiveView,
  openDmWithUser,
  openMessageSearch,
  currentUser,
} from '../store';
import type { Channel, User } from '../types';
import Icon from '../icons';
import { useEscapeClose } from '../useEscapeClose';
import './GlobalSearch.css';

export default function GlobalSearch(props: { onClose: () => void }) {
  const [query, setQuery] = createSignal('');
  const [remotePeople, setRemotePeople] = createSignal<User[]>([]);
  let peopleDebounce: ReturnType<typeof setTimeout> | undefined;
  let peopleRequestId = 0;

  useEscapeClose(props.onClose);

  const channelResults = createMemo<Channel[]>(() => {
    const q = query().trim().toLowerCase();
    if (!q) return [];
    return (bootstrap()?.channels ?? []).filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  });

  const localPeopleMatches = createMemo<User[]>(() => {
    const q = query().trim().toLowerCase();
    if (!q) return [];
    const me = currentUser()?.id;
    return (bootstrap()?.users ?? []).filter((u) => u.id !== me && u.name.toLowerCase().includes(q));
  });

  // The bootstrap user list is capped at 200 for payload size, which on a large
  // workspace covers a sliver of the org — merge in a debounced org-wide search
  // so "people" results aren't silently limited to whoever happened to load first.
  const peopleResults = createMemo<User[]>(() => {
    if (!query().trim()) return [];
    const merged = new Map<string, User>();
    for (const u of localPeopleMatches()) merged.set(u.id, u);
    for (const u of remotePeople()) merged.set(u.id, u);
    return [...merged.values()].slice(0, 8);
  });

  const runPeopleSearch = () => {
    clearTimeout(peopleDebounce);
    const q = query().trim();
    if (!q) {
      setRemotePeople([]);
      return;
    }
    const id = ++peopleRequestId;
    peopleDebounce = setTimeout(async () => {
      const found = await searchUsers(q, currentUser()?.id);
      if (id === peopleRequestId) setRemotePeople(found);
    }, 250);
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

  const goToMessageSearch = () => {
    openMessageSearch(query());
    props.onClose();
  };

  const hasQuery = createMemo(() => !!query().trim());
  const hasJumpResult = createMemo(() => channelResults().length > 0 || peopleResults().length > 0);

  return (
    <div class="global-search-overlay" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class="global-search-card">
        <div class="global-search-input-row">
          <Icon name="search" size={16} class="global-search-icon" />
          <input
            class="global-search-input"
            type="text"
            placeholder="Search channels, people…"
            value={query()}
            onInput={(e) => {
              setQuery(e.currentTarget.value);
              runPeopleSearch();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hasQuery()) goToMessageSearch();
            }}
            autofocus
          />
          <button class="global-search-close" onClick={props.onClose} title="Close">
            ✕
          </button>
        </div>

        <div class="global-search-results">
          <Show
            when={hasQuery()}
            fallback={<div class="global-search-hint">Jump to a channel or person. (Ctrl+K)</div>}
          >
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

            <div class="global-search-section">Messages</div>
            <button class="global-search-result global-search-jump global-search-message-action" onClick={goToMessageSearch}>
              <span class="global-search-jump-icon">
                <Icon name="search" size={13} />
              </span>
              Search messages for "{query()}"
            </button>

            <Show when={!hasJumpResult()}>
              <div class="global-search-empty">No channels or people matched — try searching messages above.</div>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
}
