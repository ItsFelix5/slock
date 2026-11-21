import { service } from "@slock/core/solid";
import {
  createDebouncedSearch,
  createListboxActiveIndex,
  fuzzySearch,
  listNavigationIndex,
  useClickOutside,
  useEscapeClose,
  useListShortcuts,
} from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { createMemo, createSignal, createUniqueId, For, Show } from "solid-js";
import "../../api/pickers/ComposeUserPicker.css";

const prefsStore = service("prefs");

const REMOTE_SEARCH_DELAY_MS = 250;

interface PickerItem {
  id: string;
  name: string;
}

export default function ComposePicker<T extends PickerItem>(props: {
  emptyMessage: string;
  excludeIds?: T["id"][];
  localItems: () => T[];
  notFoundMessage: string;
  onClose: () => void;
  onSelect: (id: T["id"]) => void;
  placeholder: string;
  remoteSearch: (query: string) => Promise<T[]>;
  renderItem: (item: T, isActive: boolean, optionId: string) => JSX.Element;
  searchingMessage: string;
}) {
  const [query, setQuery] = createSignal("");
  const listboxId = createUniqueId();

  let listRef: HTMLDivElement | undefined;
  const { activeIndex, setActiveIndex, optionId } = createListboxActiveIndex(
    () => items().length,
    listboxId,
    () => listRef,
  );

  useEscapeClose(props.onClose);
  useClickOutside(".compose-picker", props.onClose);

  const excludedIds = () => new Set(props.excludeIds ?? []);
  const remote = createDebouncedSearch<T[]>({
    delay: REMOTE_SEARCH_DELAY_MS,
    empty: [],
    search: (q) => props.remoteSearch(q),
  });
  const localFiltered = () => props.localItems().filter((item) => !excludedIds().has(item.id));

  const onInput = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    remote.set(value);
  };

  const items = createMemo(() => {
    const merged = new Map<string, T>();
    for (const item of localFiltered()) merged.set(item.id, item);
    const excluded = excludedIds();
    for (const item of remote.value()) {
      if (!(merged.has(item.id) || excluded.has(item.id))) merged.set(item.id, item);
    }
    const pool = [...merged.values()];
    const q = query().trim();
    if (!q) return pool.slice(0, 40);
    return fuzzySearch(pool, {
      frequency: (item) => prefsStore.frecencyScore(item.id),
      query: q,
      text: (item) => item.name,
    }).slice(0, 40);
  });

  let inputRef: HTMLInputElement | undefined;
  useListShortcuts({
    move: (direction) => {
      const next = listNavigationIndex(direction, activeIndex(), items().length);
      if (next !== undefined) setActiveIndex(next);
    },
    root: () => inputRef,
    submit: () => {
      const index = activeIndex();
      const item = index === null ? undefined : items()[index];
      if (item) props.onSelect(item.id);
    },
  });

  return (
    <div class="compose-picker surface-popover">
      <input
        autofocus
        autocomplete="off"
        class="compose-picker-input text-field"
        onInput={(e) => onInput(e.currentTarget.value)}
        placeholder={props.placeholder}
        ref={inputRef}
        spellcheck={false}
        type="text"
        value={query()}
      />
      <div class="compose-picker-list" id={listboxId} ref={listRef}>
        <Show
          fallback={
            <div class="compose-picker-empty">
              {remote.searching()
                ? props.searchingMessage
                : remote.failed()
                  ? props.notFoundMessage
                  : props.emptyMessage}
            </div>
          }
          when={items().length > 0}
        >
          <For each={items()}>
            {(item, index) => (
              <button
                class={[
                  "compose-picker-row btn-reset flex-align-center",
                  { active: activeIndex() === index() },
                ]}
                id={optionId(index())}
                onClick={() => props.onSelect(item.id)}
                onMouseEnter={() => setActiveIndex(index())}
                tabindex={-1}
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
