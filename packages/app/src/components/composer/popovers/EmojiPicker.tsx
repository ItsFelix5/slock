import { emojiUrl, hasEmojiLoadError, isEmojiLoading, loadCustomEmoji } from "@slock/blockkit";
import { Button, gridNavigationIndex, Tooltip, useEscapeClose } from "@slock/ui";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import {
  allEmojiEntries,
  frequentEmoji,
  type EmojiEntry as PickerEntry,
  searchEmoji,
} from "../lib/emojiSearch";
import "./EmojiPicker.css";
import { prioritizeEmojiEntries } from "./emojiPickerEntries";

const COLS = 8;
const BUTTON_SIZE = 32;
const GRID_GAP = 2;
const CHUNK_ROWS = 6;
const CHUNK_SIZE = COLS * CHUNK_ROWS;
const OVERSCAN_PX = 120;

type Block = { kind: "chunk"; entries: PickerEntry[] };

function rowsBlockHeight(count: number): number {
  const rows = Math.ceil(count / COLS);
  return rows * BUTTON_SIZE + Math.max(0, rows - 1) * GRID_GAP;
}

function blockHeight(block: Block): number {
  return rowsBlockHeight(block.entries.length);
}

function buildBlocks(sections: { entries: PickerEntry[] }[]): Block[] {
  const blocks: Block[] = [];
  for (const section of sections) {
    if (!section.entries.length) continue;
    for (let i = 0; i < section.entries.length; i += CHUNK_SIZE) {
      blocks.push({ entries: section.entries.slice(i, i + CHUNK_SIZE), kind: "chunk" });
    }
  }
  return blocks;
}

export default function EmojiPicker(props: {
  onSelect: (name: string) => void;
  onClose: () => void;
  existingReactions?: { name: string; mine: boolean }[];
}) {
  const [query, setQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(0);

  let bodyRef: HTMLDivElement | undefined;

  let searchInputRef: HTMLInputElement | undefined;

  useEscapeClose(props.onClose);

  onMount(() => {
    void loadCustomEmoji();

    requestAnimationFrame(() => requestAnimationFrame(() => searchInputRef?.focus()));
  });

  const allEntries = createMemo(() => allEmojiEntries());

  const reactionByName = createMemo(() => {
    const map = new Map<string, boolean>();
    for (const r of props.existingReactions ?? []) map.set(r.name, r.mine);
    return map;
  });

  const reactedEntries = createMemo(() => {
    if (!props.existingReactions?.length) return [];
    const byName = new Map(allEntries().map((entry) => [entry.name, entry]));
    return props.existingReactions
      .map((r) => byName.get(r.name))
      .filter((entry) => entry !== undefined);
  });

  const visibleEntries = createMemo(() => {
    const entries = allEntries();
    if (query().trim()) return searchEmoji(entries, query());
    const frequent = frequentEmoji(entries);
    return prioritizeEmojiEntries(entries, reactedEntries(), frequent);
  });

  const isEmpty = createMemo(() => visibleEntries().length === 0);

  const blocks = createMemo(() => buildBlocks([{ entries: visibleEntries() }]));

  const blockLayout = createMemo(() => {
    let top = 0;
    let startIndex = 0;
    const laid: { block: Block; top: number; height: number; startIndex: number }[] = [];
    for (const block of blocks()) {
      const height = blockHeight(block);
      laid.push({ block, height, startIndex, top });
      top += height;
      startIndex += block.entries.length;
    }
    return { laid, totalHeight: top };
  });

  const [scrollTop, setScrollTop] = createSignal(0);
  const [viewportHeight, setViewportHeight] = createSignal(360);

  onMount(() => {
    if (!bodyRef) return;
    setViewportHeight(bodyRef.clientHeight);
    const ro = new ResizeObserver(() => bodyRef && setViewportHeight(bodyRef.clientHeight));
    ro.observe(bodyRef);
    onCleanup(() => ro.disconnect());
  });

  createEffect(
    on(
      query,
      () => {
        setScrollTop(0);
        if (bodyRef) bodyRef.scrollTop = 0;
      },
      { defer: true },
    ),
  );

  const visible = createMemo(() => {
    const { laid, totalHeight } = blockLayout();
    const lo = scrollTop() - OVERSCAN_PX;
    const hi = scrollTop() + viewportHeight() + OVERSCAN_PX;
    let start = 0;
    while (start < laid.length && laid[start].top + laid[start].height < lo) start++;
    let end = start;
    while (end < laid.length && laid[end].top < hi) end++;
    const topSpacer = laid[start]?.top ?? 0;
    const last = laid[end - 1];
    const bottomSpacer = totalHeight - (last ? last.top + last.height : 0);
    return { bottomSpacer, list: laid.slice(start, end), topSpacer };
  });

  const keepSearchFocused = (e: MouseEvent) => {
    if (e.target !== searchInputRef) e.preventDefault();
  };

  const scrollEmojiIndexIntoView = (index: number) => {
    if (!bodyRef) return;
    const rowTop = Math.floor(index / COLS) * (BUTTON_SIZE + GRID_GAP);
    const rowBottom = rowTop + BUTTON_SIZE;
    const viewTop = scrollTop();
    const viewBottom = viewTop + viewportHeight();
    const nextTop =
      rowTop < viewTop ? rowTop : rowBottom > viewBottom ? rowBottom - viewportHeight() : viewTop;
    if (nextTop === viewTop) return;
    setScrollTop(nextTop);
    bodyRef.scrollTop = nextTop;
  };

  const GridKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"];

  const handleGridKeyDown = (e: KeyboardEvent) => {
    if (!GridKeys.includes(e.key)) return;
    const { target } = e;
    const fromSearch = target === searchInputRef;

    if (fromSearch && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    const indexAttr = target instanceof HTMLElement ? target.dataset.emojiIndex : undefined;
    const current = indexAttr === undefined ? null : Number(indexAttr);

    if (!fromSearch && e.key === "ArrowUp" && current !== null && current < COLS) {
      e.preventDefault();
      searchInputRef?.focus();
      return;
    }

    const next = gridNavigationIndex(e.key, current, visibleEntries().length, COLS);
    if (next === undefined) return;
    e.preventDefault();
    setActiveIndex(next);
    scrollEmojiIndexIntoView(next);
    queueMicrotask(() =>
      bodyRef?.querySelector<HTMLElement>(`[data-emoji-index="${next}"]`)?.focus(),
    );
  };

  return (
    <div class="emoji-picker" onKeyDown={handleGridKeyDown} onMouseDown={keepSearchFocused}>
      <div class="emoji-picker-search">
        <input
          class="search-input"
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search emoji…"
          ref={searchInputRef}
          type="text"
          value={query()}
        />
      </div>
      <Show when={isEmojiLoading()}>
        <div class="emoji-picker-notice">Loading workspace emoji…</div>
      </Show>
      <Show when={hasEmojiLoadError()}>
        <div class="emoji-picker-notice emoji-picker-error">
          <span>Couldn't load workspace emoji.</span>
          <Button onClick={() => void loadCustomEmoji()} size="sm" variant="ghost">
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
            {(item) => (
              <div class="emoji-picker-grid">
                <For each={item.block.entries}>
                  {(entry, index) => (
                    <EmojiButton
                      active={activeIndex() === item.startIndex + index()}
                      entry={entry}
                      index={item.startIndex + index()}
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

function EmojiButton(props: {
  active: boolean;
  entry: PickerEntry;
  index: number;
  onSelect: (name: string) => void;
  reactionByName: () => Map<string, boolean>;
}) {
  const url = createMemo(() => emojiUrl(props.entry.name));
  const mine = createMemo(() => props.reactionByName().get(props.entry.name) === true);
  const reacted = createMemo(() => props.reactionByName().has(props.entry.name));
  const tooltip = createMemo(() => {
    if (mine()) return `:${props.entry.name}: · you reacted`;
    if (reacted()) return `:${props.entry.name}: · already reacted`;
    return `:${props.entry.name}:`;
  });
  return (
    <Tooltip content={tooltip()}>
      <button
        aria-label={`:${props.entry.name}:`}
        aria-pressed={mine()}
        class="emoji-picker-btn btn-reset flex-center"
        classList={{ mine: mine(), reacted: reacted() }}
        data-emoji-index={props.index}
        onClick={() => props.onSelect(props.entry.name)}
        tabIndex={props.active ? 0 : -1}
        type="button"
      >
        <Show fallback={props.entry.unicode ?? "❔"} when={url()}>
          {(u) => <img alt={props.entry.name} decoding="async" loading="lazy" src={u()} />}
        </Show>
      </button>
    </Tooltip>
  );
}
