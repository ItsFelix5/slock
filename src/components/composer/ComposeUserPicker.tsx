import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { bootstrap, currentUser, searchUsers } from '../../lib/store';
import type { User } from '../../lib/types';
import { useEscapeClose } from '../../hooks/useEscapeClose';

export default function ComposeUserPicker(props: { onSelect: (userId: string) => void; onClose: () => void }) {
  const [query, setQuery] = createSignal('');
  const [remoteResults, setRemoteResults] = createSignal<User[]>([]);
  const [searching, setSearching] = createSignal(false);
  let rootRef: HTMLDivElement | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;

  useEscapeClose(props.onClose);

  onMount(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef && !rootRef.contains(e.target as Node)) props.onClose();
    };
    document.addEventListener('mousedown', onDocClick, true);
    onCleanup(() => document.removeEventListener('mousedown', onDocClick, true));
    onCleanup(() => clearTimeout(debounceTimer));
  });

  const localMatches = createMemo(() => {
    const q = query().trim().toLowerCase();
    const me = currentUser()?.id;
    return (bootstrap()?.users ?? []).filter((u) => u.id !== me && (!q || u.name.toLowerCase().includes(q)));
  });

  const onInput = (value: string) => {
    setQuery(value);
    clearTimeout(debounceTimer);
    const q = value.trim();
    if (!q) {
      setRemoteResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++requestId;
    debounceTimer = setTimeout(async () => {
      const me = currentUser()?.id;
      const found = await searchUsers(q, me);
      if (id === requestId) {
        setRemoteResults(found);
        setSearching(false);
      }
    }, 250);
  };

  // The 200-user bootstrap slice is instant but only covers a fraction of a
  // large workspace, so once a query goes out, merge in whatever the org-wide
  // directory search has found so far — local results first (no flicker),
  // remote ones appended and de-duped.
  const users = createMemo(() => {
    const q = query().trim();
    if (!q) return localMatches().slice(0, 40);
    const merged = new Map<string, User>();
    for (const u of localMatches()) merged.set(u.id, u);
    for (const u of remoteResults()) merged.set(u.id, u);
    return [...merged.values()].slice(0, 40);
  });

  return (
    <div class="compose-picker" ref={rootRef}>
      <input
        class="compose-picker-input"
        type="text"
        placeholder="Find a person…"
        value={query()}
        onInput={(e) => onInput(e.currentTarget.value)}
        autofocus
      />
      <div class="compose-picker-list">
        <Show
          when={users().length > 0}
          fallback={
            <div class="compose-picker-empty">{searching() ? 'Searching…' : 'No matches'}</div>
          }
        >
          <For each={users()}>
            {(u) => (
              <button class="compose-picker-row" onClick={() => props.onSelect(u.id)}>
                <span class="compose-picker-avatar" style={{ background: u.avatarColor }}>
                  <Show when={u.avatarUrl} fallback={u.initials}>
                    {(url) => <img src={url()} alt="" />}
                  </Show>
                </span>
                {u.name}
              </button>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
