import { emojiUrl } from "@slock/blockkit";
import { useEscapeClose } from "@slock/ui";
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
  EMOJI_CATEGORY_ORDER,
  frequentEmoji,
  type EmojiEntry as PickerEntry,
  searchEmoji,
} from "../../lib/emojiSearch";
import "./EmojiPicker.css";

const FREQUENT_LIMIT = 24;

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
const LABEL_HEIGHT = 28;
const OVERSCAN_PX = 400;

type Block = { kind: "label"; text: string } | { kind: "chunk"; entries: PickerEntry[] };

function rowsBlockHeight(count: number): number {
  const rows = Math.ceil(count / COLS);
  return rows * BUTTON_SIZE + Math.max(0, rows - 1) * GRID_GAP;
}

function blockHeight(block: Block): number {
  return block.kind === "label" ? LABEL_HEIGHT : rowsBlockHeight(block.entries.length);
}

// `label` is optional so search results can be rendered as one flat run of
// chunks with no category headers — see `blocks` below.
function buildBlocks(sections: { label?: string; entries: PickerEntry[] }[]): Block[] {
  const blocks: Block[] = [];
  for (const section of sections) {
    if (!section.entries.length) continue;
    if (section.label) blocks.push({ kind: "label", text: section.label });
    for (let i = 0; i < section.entries.length; i += CHUNK_SIZE) {
      blocks.push({ kind: "chunk", entries: section.entries.slice(i, i + CHUNK_SIZE) });
    }
  }
  return blocks;
}

export default function EmojiPicker(props: {
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = createSignal("");
  let rootRef: HTMLDivElement | undefined;
  let bodyRef: HTMLDivElement | undefined;

  useEscapeClose(props.onClose);

  onMount(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef && !rootRef.contains(e.target as Node)) props.onClose();
    };
    document.addEventListener("mousedown", onDocClick, true);
    onCleanup(() => document.removeEventListener("mousedown", onDocClick, true));
  });

  const allEntries = createMemo(() => allEmojiEntries());

  // With no search, lead with whatever's actually been picked before — the same
  // frecency signal store.ts tracks for the quick switcher's jump list.
  // Recording a use is the caller's job (see MessageActionsBar's react() and
  // Composer's onSelect) since this component is also used just to insert text.
  const frequent = createMemo(() => {
    if (query().trim()) return [];
    return frequentEmoji(allEntries(), FREQUENT_LIMIT);
  });

  // Browsing (no query) stays grouped by category so scrolling through the
  // full set is navigable. Searching drops the grouping entirely and returns
  // one flat list ranked by name-similarity to the query, then usage — a
  // dead-on match in "Custom" shouldn't get stranded below weaker matches
  // just because "Smileys" sorts first in category order.
  const groups = createMemo(() => {
    if (query().trim()) return [];
    const byCategory = new Map<string, PickerEntry[]>();
    for (const e of allEntries()) {
      const list = byCategory.get(e.category) ?? [];
      list.push(e);
      byCategory.set(e.category, list);
    }
    return EMOJI_CATEGORY_ORDER.filter((label) => byCategory.has(label)).map((label) => ({
      label,
      entries: byCategory.get(label) ?? [],
    }));
  });

  const searchResults = createMemo(() => searchEmoji(allEntries(), query()));

  const isEmpty = createMemo(
    () =>
      frequent().length === 0 &&
      searchResults().length === 0 &&
      groups().every((g) => g.entries.length === 0),
  );

  const blocks = createMemo(() =>
    query().trim()
      ? buildBlocks([{ entries: searchResults() }])
      : buildBlocks([{ label: "Frequently used", entries: frequent() }, ...groups()]),
  );

  const blockLayout = createMemo(() => {
    let top = 0;
    const laid: { block: Block; top: number; height: number }[] = [];
    for (const block of blocks()) {
      const height = blockHeight(block);
      laid.push({ block, top, height });
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
    return { list: laid.slice(start, end), topSpacer, bottomSpacer };
  });

  return (
    <div class="emoji-picker" ref={rootRef}>
      <div class="emoji-picker-search">
        <input
          type="text"
          placeholder="Search emoji…"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          autofocus
        />
      </div>
      <div
        class="emoji-picker-body"
        ref={bodyRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <Show when={!isEmpty()} fallback={<div class="emoji-picker-empty">No emoji found</div>}>
          <div style={{ height: `${visible().topSpacer}px` }} />
          <For each={visible().list}>
            {(item) =>
              item.block.kind === "label" ? (
                <div class="emoji-picker-category-label">{item.block.text}</div>
              ) : (
                <div class="emoji-picker-grid">
                  <For each={item.block.entries}>
                    {(entry) => <EmojiButton entry={entry} onSelect={props.onSelect} />}
                  </For>
                </div>
              )
            }
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
    <button
      type="button"
      class="emoji-picker-btn"
      title={`:${props.entry.name}:`}
      onClick={() => props.onSelect(props.entry.name)}
    >
      <Show when={url()} fallback={props.entry.unicode ?? "❔"}>
        {(u) => <img src={u()} alt={props.entry.name} />}
      </Show>
    </button>
  );
}
