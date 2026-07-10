import type { User } from "@slock/slack-api";
import { Avatar, fuzzySearch, useClickOutside, useEscapeClose } from "@slock/ui";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { bootstrap, currentUser, frecencyScore, searchUsers } from "../../lib/store";
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
    const me = currentUser()?.id;
    return (bootstrap()?.users ?? []).filter((u) => u.id !== me);
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
  // remote ones merged in — then rank the whole pool by fuzzy name match with
  // frecency (usage frequency/recency) as the tiebreaker, same policy as
  // GlobalSearch and the composer's @mention suggestions.
  const users = createMemo(() => {
    const merged = new Map<string, User>();
    for (const u of localUsers()) merged.set(u.id, u);
    for (const u of remoteResults()) merged.set(u.id, u);
    const pool = [...merged.values()];
    const q = query().trim();
    if (!q) return pool.slice(0, 40);
    return fuzzySearch(pool, {
      query: q,
      text: (u) => u.name,
      frequency: (u) => frecencyScore(u.id),
    }).slice(0, 40);
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
            <div class="compose-picker-empty">{searching() ? "Searching…" : "No matches"}</div>
          }
        >
          <For each={users()}>
            {(u) => (
              <button type="button" class="compose-picker-row" onClick={() => props.onSelect(u.id)}>
                <Avatar user={u} size="small" />
                {u.name}
              </button>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
