import { createMemo, createSignal, createUniqueId, For, onCleanup, Show } from "solid-js";
import { createDebouncedRequest } from "../debouncedRequest";
import { fuzzySearch } from "../fuzzy";
import Icon from "../media/Icon";
import { useClickOutside } from "../useClickOutside";
import { useEscapeClose } from "../useEscapeClose";
import "./FilterCombobox.css";
import { createListboxActiveIndex, listNavigationIndex } from "./listNavigation";

export interface ComboItem {
  id: string;
  label: string;

  score?: number;
}

export default function FilterCombobox(props: {
  placeholder: string;
  items: ComboItem[];
  value?: string;
  onSelect: (id: string | undefined) => void;

  remoteSearch?: (query: string) => Promise<ComboItem[]>;
}) {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [remoteItems, setRemoteItems] = createSignal<ComboItem[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [searchError, setSearchError] = createSignal(false);
  const [pickedLabel, setPickedLabel] = createSignal<string | undefined>(undefined);
  const listboxId = createUniqueId();

  let rootRef: HTMLDivElement | undefined;

  let triggerRef: HTMLButtonElement | undefined;

  let listRef: HTMLDivElement | undefined;
  const { activeIndex, setActiveIndex, optionId, activeOptionId } = createListboxActiveIndex(
    () => filtered().length,
    listboxId,
    () => listRef,
  );
  const remoteRequest = createDebouncedRequest(
    (query) => props.remoteSearch?.(query) ?? Promise.resolve([]),
    {
      onError: () => setSearchError(true),
      onPendingChange: setSearching,
      onReset: () => {
        setRemoteItems([]);
        setSearchError(false);
      },
      onResult: setRemoteItems,
    },
  );
  onCleanup(remoteRequest.dispose);

  const close = (restoreFocus = false) => {
    if (!open()) return;
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    remoteRequest.run("");
    if (restoreFocus)
      queueMicrotask(() =>
        (triggerRef?.isConnected ? triggerRef : rootRef?.querySelector("button"))?.focus(),
      );
  };
  useClickOutside(
    () => rootRef,
    () => close(),
  );
  useEscapeClose(() => close(true), open);

  const selectedLabel = createMemo(
    () => pickedLabel() ?? props.items.find((i) => i.id === props.value)?.label,
  );

  const filtered = createMemo(() => {
    const merged = new Map<string, ComboItem>();
    for (const i of props.items) merged.set(i.id, i);
    for (const i of remoteItems()) merged.set(i.id, i);
    const pool = [...merged.values()];
    const q = query().trim();
    if (!q) return pool.slice(0, 40);
    return fuzzySearch(pool, {
      frequency: (i) => i.score ?? 0,
      query: q,
      text: (i) => i.label,
    }).slice(0, 40);
  });

  const onInput = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    if (props.remoteSearch) remoteRequest.run(value);
  };

  const pick = (item: ComboItem) => {
    setPickedLabel(item.label);
    props.onSelect(item.id);
    close(true);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = listNavigationIndex(event.key, activeIndex(), filtered().length);
    if (next !== undefined) {
      event.preventDefault();
      setActiveIndex(next);
      return;
    }
    if (event.key !== "Enter" || event.isComposing) return;
    const index = activeIndex();
    const item = index === null ? undefined : filtered()[index];
    if (!item) return;
    event.preventDefault();
    pick(item);
  };

  return (
    <div class="filter-combobox" ref={rootRef}>
      <Show
        fallback={
          <button
            aria-expanded={open()}
            aria-haspopup="listbox"
            class="filter-combobox-trigger"
            onClick={() => (open() ? close() : setOpen(true))}
            ref={triggerRef}
            type="button"
          >
            {props.placeholder}
          </button>
        }
        when={selectedLabel()}
      >
        <button
          class="filter-combobox-chip"
          onClick={() => {
            setPickedLabel(undefined);
            props.onSelect(undefined);
          }}
          type="button"
        >
          {selectedLabel()}{" "}
          <span class="filter-combobox-clear">
            <Icon name="close" size={12} />
          </span>
        </button>
      </Show>
      <Show when={open() && !props.value}>
        <div class="filter-combobox-menu">
          <input
            aria-activedescendant={activeOptionId()}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={true}
            aria-label={`Filter ${props.placeholder}`}
            autofocus
            autocomplete="off"
            class="filter-combobox-input search-input"
            onInput={(e) => onInput(e.currentTarget.value)}
            onKeyDown={onKeyDown}
            placeholder="Type to filter…"
            spellcheck={false}
            type="text"
            value={query()}
          />
          <div
            aria-busy={searching()}
            aria-label={`${props.placeholder} suggestions`}
            class="filter-combobox-list"
            id={listboxId}
            ref={listRef}
          >
            <For
              each={filtered()}
              fallback={
                <div class="filter-combobox-empty">
                  {searching()
                    ? "Searching…"
                    : searchError()
                      ? "Couldn't load suggestions"
                      : "No matches"}
                </div>
              }
            >
              {(item, index) => (
                <button
                  aria-selected={activeIndex() === index()}
                  class="filter-combobox-item"
                  classList={{ active: activeIndex() === index() }}
                  id={optionId(index())}
                  onClick={() => pick(item)}
                  onMouseEnter={() => setActiveIndex(index())}
                  tabIndex={-1}
                  type="button"
                >
                  {item.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
