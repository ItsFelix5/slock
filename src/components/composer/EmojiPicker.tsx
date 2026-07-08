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
import { useEscapeClose } from "../../hooks/useEscapeClose";
import { customEmojiNames, emojiUrl } from "../../lib/emojiCache";
import { EMOJI_CATEGORIES } from "../../lib/emojiCategories";
import { emojiUseScore } from "../../lib/store";
import "./EmojiPicker.css";

interface PickerEntry {
  name: string;
  unicode?: string;
  category: string;
  searchText: string;
}

const STANDARD_ENTRIES: PickerEntry[] = EMOJI_CATEGORIES.flatMap((group) =>
  group.entries.map(
    (e): PickerEntry => ({
      name: e.names[0],
      unicode: e.emoji,
      category: group.label,
      searchText: [...e.names, ...e.tags, e.description].join(" ").toLowerCase(),
    }),
  ),
);

const CATEGORY_ORDER = ["Custom", ...EMOJI_CATEGORIES.map((g) => g.label)];
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

function buildBlocks(sections: { label: string; entries: PickerEntry[] }[]): Block[] {
  const blocks: Block[] = [];
  for (const section of sections) {
    if (!section.entries.length) continue;
    blocks.push({ kind: "label", text: section.label });
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

  const customEntries = createMemo<PickerEntry[]>(() =>
    customEmojiNames()
      .filter((n) => emojiUrl(n))
      .map((name) => ({ name, category: "Custom", searchText: name })),
  );

  const allEntries = createMemo(() => [...customEntries(), ...STANDARD_ENTRIES]);

  // With no search, lead with whatever's actually been picked before — the same
  // frecency signal store.ts tracks for the quick switcher's jump list.
  // Recording a use is the caller's job (see MessageActionsBar's react() and
  // Composer's onSelect) since this component is also used just to insert text.
  const frequent = createMemo(() => {
    if (query().trim()) return [];
    return allEntries()
      .map((e) => ({ e, score: emojiUseScore(e.name) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, FREQUENT_LIMIT)
      .map((x) => x.e);
  });

  const groups = createMemo(() => {
    const q = query().trim().toLowerCase();
    const entries = allEntries();
    const filtered = q ? entries.filter((e) => e.searchText.includes(q)) : entries;
    const byCategory = new Map<string, PickerEntry[]>();
    for (const e of filtered) {
      const list = byCategory.get(e.category) ?? [];
      list.push(e);
      byCategory.set(e.category, list);
    }
    // While searching, rank each category's matches by usage frequency too, so
    // a frequently-picked emoji still surfaces near the top of its group.
    if (q) {
      for (const list of byCategory.values())
        list.sort((a, b) => emojiUseScore(b.name) - emojiUseScore(a.name));
    }
    return CATEGORY_ORDER.filter((label) => byCategory.has(label)).map((label) => ({
      label,
      entries: byCategory.get(label)!,
    }));
  });

  const isEmpty = createMemo(
    () => frequent().length === 0 && groups().every((g) => g.entries.length === 0),
  );

  const blocks = createMemo(() =>
    buildBlocks([{ label: "Frequently used", entries: frequent() }, ...groups()]),
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
