import { defined } from "@slock/core";
import { service } from "@slock/core/solid";
import type { Message } from "@slock/types";
import {
  findTextRanges,
  indexElementText,
  type TextIndex,
  useEscapeClose,
  useShortcut,
} from "@slock/ui";
import { type Accessor, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import type { FeedScroll } from "./scroll/feedScroll";

const ALL_MATCHES = "search-match";
const CURRENT_MATCH = "search-match-current";

function indexContainer(container: HTMLElement): Map<string, TextIndex> {
  const index = new Map<string, TextIndex>();
  for (const row of container.querySelectorAll<HTMLElement>("[data-message-ts]")) {
    const ts = row.dataset.messageTs;
    const textEl = row.querySelector(".message-text");
    if (ts && textEl) index.set(ts, indexElementText(textEl));
  }
  return index;
}

function clearHighlights() {
  CSS.highlights.delete(ALL_MATCHES);
  CSS.highlights.delete(CURRENT_MATCH);
}

export function createInPaneSearch(
  messages: Accessor<Message[]>,
  feed: FeedScroll,
  paneId: Accessor<string>,
) {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [matchIndex, setMatchIndex] = createSignal(0);

  const rowIndex = createMemo(() => {
    if (!open()) return;
    const el = feed.element();
    if (!el) return;
    messages();
    return indexContainer(el);
  });

  const matches = createMemo(() => {
    const q = query().trim().toLowerCase();
    const index = rowIndex();
    if (!(q && index)) return [];
    return messages().filter((m) => index.get(m.ts)?.text.includes(q));
  });

  let hasJumpedSinceQueryChange = false;
  const jump = (index: number) => {
    const list = matches();
    if (!list.length) return;
    const wrapped = ((index % list.length) + list.length) % list.length;
    setMatchIndex(wrapped);
    hasJumpedSinceQueryChange = true;
    feed.glideTo(defined(list[wrapped]).ts);
  };
  const jumpRelative = (delta: number) =>
    jump(hasJumpedSinceQueryChange ? matchIndex() + delta : matchIndex());

  const close = () => {
    setOpen(false);
    setQuery("");
    setMatchIndex(0);
  };

  createEffect(
    () => ({
      current: matches()[matchIndex()],
      index: rowIndex(),
      list: matches(),
      q: query().trim().toLowerCase(),
    }),
    ({ current, index, list, q }) => {
      if (!(q && index)) {
        clearHighlights();
        return;
      }
      const currentRanges: Range[] = [];
      const otherRanges: Range[] = [];
      for (const m of list) {
        const row = index.get(m.ts);
        if (!row) continue;
        const ranges = findTextRanges(row, q);
        (m.ts === current?.ts ? currentRanges : otherRanges).push(...ranges);
      }
      CSS.highlights.set(ALL_MATCHES, new Highlight(...otherRanges));
      CSS.highlights.set(CURRENT_MATCH, new Highlight(...currentRanges));
    },
  );
  onCleanup(clearHighlights);

  useShortcut({
    allowInInputs: true,
    allowRepeat: false,
    combo: { key: "f", mod: true },
    enabled: () => service("shell.panes").focusedPaneId() === paneId(),
    handler: () => setOpen(true),
    id: "messages.searchInPane",
    label: "Search in this view",
    scope: "lists",
    group: "Lists",
  });
  useEscapeClose(close, open);

  return {
    close,
    goNext: () => jumpRelative(1),
    goPrev: () => jumpRelative(-1),
    matchCount: () => matches().length,
    matchIndex,
    open,
    query,
    setQuery: (value: string) => {
      setQuery(value);
      setMatchIndex(0);
      hasJumpedSinceQueryChange = false;
    },
  };
}
