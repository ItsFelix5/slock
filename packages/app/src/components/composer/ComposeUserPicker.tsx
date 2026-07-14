import type { User } from "@slock/slack-api";
import { Avatar, fuzzySearch, useClickOutside, useEscapeClose } from "@slock/ui";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { store } from "../../lib/store";
import "./ComposeUserPicker.css";

export default function ComposeUserPicker(props: {
  onSelect: (userId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = createSignal("");
  const [remoteResults, setRemoteResults] = createSignal<User[]>([]);
  const [searching, setSearching] = createSignal(false);
  let rootRef: HTMLDivElement | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;

  useEscapeClose(props.onClose);
  useClickOutside(".compose-picker", props.onClose);

  onMount(() => {
    onCleanup(() => clearTimeout(debounceTimer));
  });

  const localUsers = createMemo(() => {
    const me = store.users.currentUser()?.id;
    return store.users.knownUsers().filter((u) => u.id !== me);
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
      const me = store.users.currentUser()?.id;
      const found = await store.users.searchUsers(q, me);
      if (id === requestId) {
        setRemoteResults(found);
        setSearching(false);
      }
    }, 250);
  };

  // Local results (anyone already resolved this session) show instantly with no
  // flicker; once a query goes out, merge in whatever the org-wide directory search
  // has found so far, then rank the whole pool by fuzzy name match with frecency
  // (usage frequency/recency) as the tiebreaker, same policy as GlobalSearch and
  // the composer's @mention suggestions.
  const users = createMemo(() => {
    const merged = new Map<string, User>();
    for (const u of localUsers()) merged.set(u.id, u);
    for (const u of remoteResults()) merged.set(u.id, u);
    const pool = [...merged.values()];
    const q = query().trim();
    if (!q) return pool.slice(0, 40);
    return fuzzySearch(pool, {
      frequency: (u) => store.preferences.frecencyScore(u.id),
      query: q,
      text: (u) => u.name,
    }).slice(0, 40);
  });

  return (
    <div class="compose-picker" ref={rootRef}>
      <input
        autofocus
        class="compose-picker-input"
        onInput={(e) => onInput(e.currentTarget.value)}
        placeholder="Find a person…"
        type="text"
        value={query()}
      />
      <div class="compose-picker-list">
        <Show
          fallback={
            <div class="compose-picker-empty">{searching() ? "Searching…" : "No matches"}</div>
          }
          when={users().length > 0}
        >
          <For each={users()}>
            {(u) => (
              <button
                class="compose-picker-row btn-reset flex-align-center"
                onClick={() => props.onSelect(u.id)}
                type="button"
              >
                <Avatar size="small" user={u} />
                {u.name}
              </button>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
