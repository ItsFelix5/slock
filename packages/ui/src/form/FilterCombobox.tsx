import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { fuzzySearch } from "../fuzzy";
import { useClickOutside } from "../useClickOutside";
import "./FilterCombobox.css";
import Icon from "../media/Icon";

export interface ComboItem {
  id: string;
  label: string;
  // Optional usage frequency/frecency, higher = used more. Only breaks ties
  // between equally-good fuzzy matches — same policy as every other searcher.
  score?: number;
}

export default function FilterCombobox(props: {
  placeholder: string;
  items: ComboItem[];
  value?: string;
  onSelect: (id: string | undefined) => void;
  // Optional org-wide search for lists too large to ship to the client in full
  // (e.g. a ~100k-member workspace's users) — local `items` still match instantly,
  // this fills in results beyond that capped local set as the user types.
  remoteSearch?: (query: string) => Promise<ComboItem[]>;
}) {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [remoteItems, setRemoteItems] = createSignal<ComboItem[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [pickedLabel, setPickedLabel] = createSignal<string | undefined>(undefined);
  let rootRef: HTMLDivElement | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;

  useClickOutside(
    () => rootRef,
    () => setOpen(false),
  );
  onCleanup(() => clearTimeout(debounceTimer));

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
      query: q,
      text: (i) => i.label,
      frequency: (i) => i.score ?? 0,
    }).slice(0, 40);
  });

  const onInput = (value: string) => {
    setQuery(value);
    if (!props.remoteSearch) return;
    clearTimeout(debounceTimer);
    const q = value.trim();
    if (!q) {
      setRemoteItems([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++requestId;
    debounceTimer = setTimeout(async () => {
      const found = await props.remoteSearch?.(q);
      if (id === requestId) {
        setRemoteItems(found ?? []);
        setSearching(false);
      }
    }, 250);
  };

  const pick = (item: ComboItem) => {
    setPickedLabel(item.label);
    props.onSelect(item.id);
    setOpen(false);
    setQuery("");
    setRemoteItems([]);
  };

  return (
    <div class="filter-combobox" ref={rootRef}>
      <Show
        when={!props.value}
        fallback={
          <button
            type="button"
            class="filter-combobox-chip"
            onClick={() => {
              setPickedLabel(undefined);
              props.onSelect(undefined);
            }}
          >
            {selectedLabel()}{" "}
            <span class="filter-combobox-clear">
              <Icon name="close" size={12} />
            </span>
          </button>
        }
      >
        <button type="button" class="filter-combobox-trigger" onClick={() => setOpen(!open())}>
          {props.placeholder}
        </button>
      </Show>
      <Show when={open() && !props.value}>
        <div class="filter-combobox-menu">
          <input
            class="filter-combobox-input search-input"
            type="text"
            placeholder="Type to filter…"
            value={query()}
            onInput={(e) => onInput(e.currentTarget.value)}
            autofocus
          />
          <div class="filter-combobox-list">
            <For
              each={filtered()}
              fallback={
                <div class="filter-combobox-empty">{searching() ? "Searching…" : "No matches"}</div>
              }
            >
              {(item) => (
                <button type="button" class="filter-combobox-item" onClick={() => pick(item)}>
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
