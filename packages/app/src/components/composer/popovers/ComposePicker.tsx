import {
  createDebouncedRequest,
  createListboxActiveIndex,
  fuzzySearch,
  listNavigationIndex,
  useClickOutside,
  useEscapeClose,
} from "@slock/ui";
import type { JSX } from "solid-js";
import { createMemo, createSignal, createUniqueId, For, onCleanup, Show } from "solid-js";
import { store } from "../../../lib/store";
import "./ComposeUserPicker.css";

interface PickerItem {
  id: string;
  name: string;
}

export default function ComposePicker<T extends PickerItem>(props: {
  ariaLabel: string;
  emptyMessage: string;
  excludeIds?: string[];
  localItems: () => T[];
  notFoundMessage: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  placeholder: string;
  remoteSearch: (query: string) => Promise<T[]>;
  renderItem: (item: T, isActive: boolean, optionId: string) => JSX.Element;
  searchingMessage: string;
}) {
  const [query, setQuery] = createSignal("");
  const [remoteResults, setRemoteResults] = createSignal<T[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [searchError, setSearchError] = createSignal(false);
  const listboxId = createUniqueId();

  let listRef: HTMLDivElement | undefined;
  const { activeIndex, setActiveIndex, optionId, activeOptionId } = createListboxActiveIndex(
    () => items().length,
    listboxId,
    () => listRef,
  );

  useEscapeClose(props.onClose);
  useClickOutside(".compose-picker", props.onClose);

  const excludedIds = createMemo(() => new Set(props.excludeIds ?? []));
  const remoteRequest = createDebouncedRequest(
    async (q) => (await props.remoteSearch(q)).filter((item) => !excludedIds().has(item.id)),
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

  const localFiltered = createMemo(() =>
    props.localItems().filter((item) => !excludedIds().has(item.id)),
  );

  const onInput = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    remoteRequest.run(value);
  };

  const items = createMemo(() => {
    const merged = new Map<string, T>();
    for (const item of localFiltered()) merged.set(item.id, item);
    for (const item of remoteResults()) {
      if (!merged.has(item.id)) merged.set(item.id, item);
    }
    const pool = [...merged.values()];
    const q = query().trim();
    if (!q) return pool.slice(0, 40);
    return fuzzySearch(pool, {
      frequency: (item) => store.preferences.frecencyScore(item.id),
      query: q,
      text: (item) => item.name,
    }).slice(0, 40);
  });

  const onKeyDown = (event: KeyboardEvent) => {
    const next = listNavigationIndex(event.key, activeIndex(), items().length);
    if (next !== undefined) {
      event.preventDefault();
      setActiveIndex(next);
      return;
    }
    if (event.key !== "Enter" || event.isComposing) return;
    const index = activeIndex();
    const item = index === null ? undefined : items()[index];
    if (!item) return;
    event.preventDefault();
    props.onSelect(item.id);
  };

  return (
    <div class="compose-picker">
      <input
        aria-activedescendant={activeOptionId()}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={true}
        aria-label={props.ariaLabel}
        autofocus
        autocomplete="off"
        class="compose-picker-input"
        onInput={(e) => onInput(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        placeholder={props.placeholder}
        spellcheck={false}
        type="text"
        value={query()}
      />
      <div
        aria-busy={searching()}
        aria-label={props.ariaLabel}
        class="compose-picker-list"
        id={listboxId}
        ref={listRef}
      >
        <Show
          fallback={
            <div class="compose-picker-empty">
              {searching()
                ? props.searchingMessage
                : searchError()
                  ? props.notFoundMessage
                  : props.emptyMessage}
            </div>
          }
          when={items().length > 0}
        >
          <For each={items()}>
            {(item, index) => (
              <button
                aria-selected={activeIndex() === index()}
                class="compose-picker-row btn-reset flex-align-center"
                classList={{ active: activeIndex() === index() }}
                id={optionId(index())}
                onClick={() => props.onSelect(item.id)}
                onMouseEnter={() => setActiveIndex(index())}
                tabIndex={-1}
                type="button"
              >
                {props.renderItem(item, activeIndex() === index(), optionId(index()))}
              </button>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
