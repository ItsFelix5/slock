import { service } from "@slock/core/solid";
import {
  Button,
  createResetSignal,
  gridNavigationIndex,
  inside,
  type NavDirection,
  useEscapeClose,
  useGridShortcuts,
  useListShortcuts,
  useShortcut,
} from "@slock/ui";
import { createEffect, createMemo, createSignal, For, onSettled, Show } from "solid-js";
import { PICKER_SHORTCUTS } from "../pickerShortcuts";
import "./EmojiPicker.css";
import EmojiPickerButton from "../EmojiPickerButton";
import { prioritizeEmojiEntries } from "../emojiPickerEntries";
import { EMOJI_COLUMNS, layoutChunks, scrollTopToReveal, visibleChunks } from "./emojiGridLayout";

const emojiIndex = service("emoji");

export default function EmojiPicker(props: {
  onSelect: (name: string) => void;
  onClose: () => void;
  existingReactions?: { name: string; mine: boolean }[];
}) {
  const [query, setQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createResetSignal(query, 0);

  let bodyRef: HTMLDivElement | undefined;

  let searchInputRef: HTMLInputElement | undefined;

  useEscapeClose(props.onClose);

  onSettled(() => {
    void emojiIndex.source.load();
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => searchInputRef?.focus());
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  });

  const allEntries = emojiIndex.allEmojiEntries;

  const reactionByName = createMemo(() => {
    const map = new Map<string, boolean>();
    for (const r of props.existingReactions ?? []) map.set(r.name, r.mine);
    return map;
  });

  const reactedEntries = createMemo(() => {
    if (!props.existingReactions?.length) return [];
    return props.existingReactions
      .map((r) => emojiIndex.emojiEntryByName(r.name))
      .filter((entry) => entry !== undefined);
  });

  const visibleEntries = createMemo(() => {
    const entries = allEntries();
    if (query().trim()) return emojiIndex.searchEmoji(entries, query());
    const frequent = emojiIndex.frequentEmoji();
    return prioritizeEmojiEntries(entries, reactedEntries(), frequent);
  });

  const isEmpty = () => visibleEntries().length === 0;

  const layout = createMemo(() => layoutChunks(visibleEntries()));

  const [scrollTop, setScrollTop] = createResetSignal(query, 0);
  const [viewportHeight, setViewportHeight] = createSignal(360);

  onSettled(() => {
    if (!bodyRef) return;
    const measure = () => bodyRef && setViewportHeight(bodyRef.clientHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  createEffect(
    query,
    () => {
      if (bodyRef) bodyRef.scrollTop = 0;
    },
    { defer: true },
  );

  const visible = createMemo(() => visibleChunks(layout(), scrollTop(), viewportHeight()));

  const keepSearchFocused = (e: MouseEvent) => {
    if (e.target !== searchInputRef) e.preventDefault();
  };

  const scrollEmojiIndexIntoView = (index: number) => {
    if (!bodyRef) return;
    const nextTop = scrollTopToReveal(index, scrollTop(), viewportHeight());
    if (nextTop === scrollTop()) return;
    setScrollTop(nextTop);
    bodyRef.scrollTop = nextTop;
  };

  const selectActive = () => {
    const entry = visibleEntries()[activeIndex()];
    if (entry) props.onSelect(entry.name);
  };

  const moveGrid = (direction: NavDirection) => {
    const { activeElement } = document;
    const fromSearch = activeElement === searchInputRef;
    const indexAttr =
      activeElement instanceof HTMLElement ? activeElement.dataset.emojiIndex : undefined;
    const current = indexAttr === undefined ? null : Number(indexAttr);

    if (!fromSearch && direction === "up" && current !== null && current < EMOJI_COLUMNS) {
      searchInputRef?.focus();
      return;
    }

    const next = gridNavigationIndex(direction, current, visibleEntries().length, EMOJI_COLUMNS);
    if (next === undefined) return;
    setActiveIndex(next);
    scrollEmojiIndexIntoView(next);
    queueMicrotask(() =>
      bodyRef?.querySelector<HTMLElement>(`[data-emoji-index="${next}"]`)?.focus(),
    );
  };

  useListShortcuts({
    edges: false,
    move: moveGrid,
    root: () => searchInputRef,
    submit: selectActive,
  });
  useGridShortcuts({ move: moveGrid, root: () => bodyRef, submit: selectActive });
  for (const { direction, spec } of PICKER_SHORTCUTS) {
    useShortcut({
      ...spec,
      allowRepeat: true,
      handler: () => moveGrid(direction),
      target: inside(
        () => searchInputRef,
        () => bodyRef,
      ),
    });
  }

  return (
    <div class="emoji-picker surface-popover flex-col" onMouseDown={keepSearchFocused}>
      <div class="emoji-picker-search">
        <input
          class="text-field"
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search emoji…"
          ref={searchInputRef}
          type="text"
          value={query()}
        />
      </div>
      <Show when={emojiIndex.source.loading()}>
        <div class="emoji-picker-notice flex-between gap-sm">Loading workspace emoji…</div>
      </Show>
      <Show when={emojiIndex.source.failed()}>
        <div class="emoji-picker-notice flex-between gap-sm emoji-picker-error">
          <span>Couldn't load workspace emoji.</span>
          <Button onClick={() => void emojiIndex.source.load()} size="sm">
            Try again
          </Button>
        </div>
      </Show>
      <div
        class="emoji-picker-body"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        ref={bodyRef}
      >
        <Show fallback={<div class="emoji-picker-empty">No emoji found</div>} when={!isEmpty()}>
          <div style={{ height: `${visible().topSpacer}px` }} />
          <For each={visible().list}>
            {(chunk) => (
              <div class="emoji-picker-grid">
                <For each={chunk.entries}>
                  {(entry, index) => (
                    <EmojiPickerButton
                      active={activeIndex() === chunk.startIndex + index()}
                      entry={entry}
                      index={chunk.startIndex + index()}
                      onSelect={props.onSelect}
                      reactionByName={reactionByName}
                    />
                  )}
                </For>
              </div>
            )}
          </For>
          <div style={{ height: `${visible().bottomSpacer}px` }} />
        </Show>
      </div>
    </div>
  );
}
