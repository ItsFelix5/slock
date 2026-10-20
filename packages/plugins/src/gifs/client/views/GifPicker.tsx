import { service } from "@slock/core/solid";
import {
  gridNavigationIndex,
  IconButton,
  type NavDirection,
  SegmentedControl,
  useClickOutside,
  useEscapeClose,
  useGridShortcuts,
  useListShortcuts,
} from "@slock/ui";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { createKeyedQuery, defineKey } from "../../../query/client/api";
import type { Gif } from "../store";
import { loadGifs } from "../tenor";
import "./GifPicker.css";

const gifs = service("gifs");

const COLS = 2;
const SEARCH_DELAY_MS = 250;
const STALE_MS = 5 * 60 * 1000;
const gifsKey = defineKey<[string]>("gifs");

export default function GifPicker(props: { onClose: () => void; onSelect: (gif: Gif) => void }) {
  const [input, setInput] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [tab, setTab] = createSignal<"favorites" | "trending">(
    gifs.favorites().length ? "favorites" : "trending",
  );
  const tenor = createKeyedQuery(() => ({
    queryFn: () => loadGifs(query()),
    queryKey: gifsKey(query()),
    staleTime: STALE_MS,
  }));
  let searchRef: HTMLInputElement | undefined;
  let bodyRef: HTMLDivElement | undefined;
  let delay: ReturnType<typeof setTimeout> | undefined;

  useEscapeClose(props.onClose);
  useClickOutside(".gif-picker", props.onClose);
  onMount(() => requestAnimationFrame(() => searchRef?.focus()));
  onCleanup(() => clearTimeout(delay));

  const showingFavorites = () => tab() === "favorites" && !query();
  const entries = createMemo(() => (showingFavorites() ? gifs.favorites() : (tenor.data ?? [])));

  const selectTab = (next: "favorites" | "trending") => {
    setTab(next);
    setActiveIndex(0);
  };

  const onInput = (value: string) => {
    setInput(value);
    setActiveIndex(0);
    clearTimeout(delay);
    delay = setTimeout(() => setQuery(value.trim()), SEARCH_DELAY_MS);
  };

  const focusTile = (index: number) =>
    queueMicrotask(() =>
      bodyRef?.querySelector<HTMLElement>(`[data-gif-index="${index}"]`)?.focus(),
    );

  const move = (direction: NavDirection) => {
    const { activeElement } = document;
    const attr = activeElement instanceof HTMLElement ? activeElement.dataset.gifIndex : undefined;
    const current = attr === undefined ? null : Number(attr);
    if (direction === "up" && current !== null && current < COLS) {
      searchRef?.focus();
      return;
    }
    const next = gridNavigationIndex(direction, current, entries().length, COLS);
    if (next === undefined) return;
    setActiveIndex(next);
    focusTile(next);
  };

  const selectActive = () => {
    const gif = entries()[activeIndex()];
    if (gif) props.onSelect(gif);
  };

  useListShortcuts({ edges: false, move, root: () => searchRef, submit: selectActive });
  useGridShortcuts({ move, root: () => bodyRef, submit: selectActive });

  return (
    <div class="gif-picker surface-popover flex-col">
      <div class="gif-picker-search">
        <input
          class="text-field"
          onInput={(e) => onInput(e.currentTarget.value)}
          placeholder="Search Tenor"
          ref={searchRef}
          type="text"
          value={input()}
        />
        <SegmentedControl class="gif-picker-tabs">
          <button
            class={`segmented-control-btn${showingFavorites() ? " active" : ""}`}
            onClick={() => selectTab("favorites")}
            type="button"
          >
            Favorites
          </button>
          <button
            class={`segmented-control-btn${showingFavorites() ? "" : " active"}`}
            onClick={() => selectTab("trending")}
            type="button"
          >
            {query() ? "Results" : "Trending"}
          </button>
        </SegmentedControl>
      </div>
      <div class="gif-picker-body" ref={bodyRef}>
        <Show when={showingFavorites() && entries().length === 0}>
          <div class="gif-picker-status">Star a GIF to save it here</div>
        </Show>
        <Show when={!showingFavorites() && tenor.isError}>
          <div class="gif-picker-status">Tenor is unreachable</div>
        </Show>
        <Show when={!showingFavorites() && tenor.isSuccess && entries().length === 0}>
          <div class="gif-picker-status">No GIFs found</div>
        </Show>
        <div class="gif-picker-grid">
          <For each={entries()}>
            {(gif, index) => (
              <div
                class="gif-picker-tile"
                data-gif-index={index()}
                onClick={() => props.onSelect(gif)}
                onKeyDown={(e) => {
                  if (e.key === "f") gifs.toggleFavorite(gif);
                }}
                role="button"
                tabIndex={0}
              >
                <img alt="" loading="lazy" src={gif.preview} />
                <IconButton
                  active={gifs.isFavorite(gif)}
                  class="gif-picker-star"
                  icon={gifs.isFavorite(gif) ? "star-filled" : "star"}
                  label={gifs.isFavorite(gif) ? "Remove from favorites" : "Add to favorites"}
                  onClick={(e) => {
                    e.stopPropagation();
                    gifs.toggleFavorite(gif);
                  }}
                  size="sm"
                />
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
