import type { User } from "@slock/slack-api";
import {
  Avatar,
  createDebouncedRequest,
  fuzzySearch,
  listNavigationIndex,
  scrollActiveListOption,
  useClickOutside,
  useEscapeClose,
} from "@slock/ui";
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { store } from "../../../lib/store";
import "./ComposeUserPicker.css";

export default function ComposeUserPicker(props: {
  excludeUserIds?: string[];
  includeCurrentUser?: boolean;
  onSelect: (userId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = createSignal("");
  const [remoteResults, setRemoteResults] = createSignal<User[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [searchError, setSearchError] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal<number | null>(0);
  const listboxId = createUniqueId();
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let listRef: HTMLDivElement | undefined;

  useEscapeClose(props.onClose);
  useClickOutside(".compose-picker", props.onClose);

  const excludedUserIds = createMemo(() => new Set(props.excludeUserIds ?? []));
  const remoteRequest = createDebouncedRequest(
    async (query) => {
      const me = props.includeCurrentUser ? undefined : store.users.currentUser()?.id;
      return (await store.users.searchUsers(query, me)).filter(
        (user) => !excludedUserIds().has(user.id),
      );
    },
    {
      onError: () => setSearchError(true),
      onPendingChange: setSearching,
      onReset: () => {
        setRemoteResults([]);
        setSearchError(false);
      },
      onResult: setRemoteResults,
    },
  );
  onCleanup(() => {
    remoteRequest.dispose();
  });

  const localUsers = createMemo(() => {
    const me = store.users.currentUser();
    const users = new Map(store.users.knownUsers().map((user) => [user.id, user]));
    if (props.includeCurrentUser && me) users.set(me.id, me);
    return [...users.values()].filter(
      (user) => !excludedUserIds().has(user.id) && (props.includeCurrentUser || user.id !== me?.id),
    );
  });

  const onInput = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    remoteRequest.run(value);
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
  createEffect(() => {
    const count = users().length;
    const current = activeIndex();
    if (count === 0) setActiveIndex(null);
    else if (current === null || current >= count) setActiveIndex(0);
  });
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const activeOptionId = () => {
    const index = activeIndex();
    return index === null ? undefined : optionId(index);
  };
  createEffect(() => {
    activeIndex();
    scrollActiveListOption(() => listRef);
  });
  const onKeyDown = (event: KeyboardEvent) => {
    const next = listNavigationIndex(event.key, activeIndex(), users().length);
    if (next !== undefined) {
      event.preventDefault();
      setActiveIndex(next);
      return;
    }
    if (event.key !== "Enter" || event.isComposing) return;
    const index = activeIndex();
    const user = index === null ? undefined : users()[index];
    if (!user) return;
    event.preventDefault();
    props.onSelect(user.id);
  };

  return (
    <div class="compose-picker">
      <input
        aria-activedescendant={activeOptionId()}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={true}
        aria-label="Find a person"
        autofocus
        autocomplete="off"
        class="compose-picker-input"
        onInput={(e) => onInput(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        placeholder="Find a person…"
        role="combobox"
        spellcheck={false}
        type="text"
        value={query()}
      />
      <div
        aria-busy={searching()}
        aria-label="People suggestions"
        class="compose-picker-list"
        id={listboxId}
        ref={listRef}
        role="listbox"
      >
        <Show
          fallback={
            <div class="compose-picker-empty" role="status">
              {searching() ? "Searching…" : searchError() ? "Couldn’t load people" : "No matches"}
            </div>
          }
          when={users().length > 0}
        >
          <For each={users()}>
            {(u, index) => (
              <button
                aria-selected={activeIndex() === index()}
                class="compose-picker-row btn-reset flex-align-center"
                classList={{ active: activeIndex() === index() }}
                id={optionId(index())}
                onClick={() => props.onSelect(u.id)}
                onMouseEnter={() => setActiveIndex(index())}
                role="option"
                tabIndex={-1}
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
