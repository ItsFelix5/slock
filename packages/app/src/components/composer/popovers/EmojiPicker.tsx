import { emojiUrl, loadCustomEmoji } from "@slock/blockkit";
import { Tooltip, useEscapeClose } from "@slock/ui";
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
} from "../../../lib/emojiSearch";
import "./EmojiPicker.css";

// Workspaces can have tens of thousands of custom emoji, so rendering every
// entry's DOM node up front (as a plain <For>) is what made the picker take
// seconds to open. Instead we virtualize: entries are chunked into fixed-size
// grid blocks, and only the blocks intersecting the scrolled viewport (plus a
// little overscan) actually get mounted, with spacer divs standing in for the
// rest so the scrollbar still reflects the true content size.
const COLS = 8;
const BUTTON_SIZE = 32;
const GRID_GAP = 2;
const CHUNK_ROWS = 6;
const CHUNK_SIZE = COLS * CHUNK_ROWS;
const OVERSCAN_PX = 400;

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
}) {
  const [query, setQuery] = createSignal("");
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let rootRef: HTMLDivElement | undefined;
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let bodyRef: HTMLDivElement | undefined;

  useEscapeClose(props.onClose);

  onMount(() => {
    void loadCustomEmoji();
    const onDocClick = (e: MouseEvent) => {
      if (rootRef && !rootRef.contains(e.target as Node)) props.onClose();
    };
    document.addEventListener("mousedown", onDocClick, true);
    onCleanup(() => document.removeEventListener("mousedown", onDocClick, true));
  });

  const allEntries = createMemo(() => allEmojiEntries());

  // With no search, lead with whatever Slack's own emoji-use counts (from
  // users.prefs.get, see store.ts's emojiUseScore) say has actually been
  // picked before.
  const frequent = createMemo(() => {
    if (query().trim()) return [];
    return frequentEmoji(allEntries());
  });

  const searchResults = createMemo(() => searchEmoji(allEntries(), query()));

  const isEmpty = createMemo(() => frequent().length === 0 && searchResults().length === 0);

  const blocks = createMemo(() =>
    buildBlocks([{ entries: frequent() }, { entries: searchResults() }]),
  );

  const blockLayout = createMemo(() => {
    let top = 0;
    const laid: { block: Block; top: number; height: number }[] = [];
    for (const block of blocks()) {
      const height = blockHeight(block);
      laid.push({ block, height, top });
      top += height;
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

  // A new query reflows the whole block layout, so a stale scroll offset would
  // otherwise leave the (now much shorter) results scrolled out of view.
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

  return (
    <div class="emoji-picker" ref={rootRef}>
      <div class="emoji-picker-search">
        <input
          autofocus
          class="search-input"
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search emoji…"
          type="text"
          value={query()}
        />
      </div>
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
                  {(entry) => <EmojiButton entry={entry} onSelect={props.onSelect} />}
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

function EmojiButton(props: { entry: PickerEntry; onSelect: (name: string) => void }) {
  const url = createMemo(() => emojiUrl(props.entry.name));
  return (
    <Tooltip content={`:${props.entry.name}:`}>
      <button
        aria-label={`:${props.entry.name}:`}
        class="emoji-picker-btn btn-reset flex-center"
        onClick={() => props.onSelect(props.entry.name)}
        type="button"
      >
        <Show fallback={props.entry.unicode ?? "❔"} when={url()}>
          {(u) => <img alt={props.entry.name} src={u()} />}
        </Show>
      </button>
    </Tooltip>
  );
}
