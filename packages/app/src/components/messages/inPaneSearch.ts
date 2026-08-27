import { focusedPaneId, useEscapeClose, useShortcut } from "@slock/ui";
import { type Accessor, createMemo, createSignal, onCleanup } from "solid-js";
import type { Message } from "../../lib/api";
import { jumpToMessageInContainer } from "./scrollAnchor";

export function createInPaneSearch(
  messages: Accessor<Message[]>,
  container: Accessor<HTMLElement | undefined>,
  paneId: Accessor<string>,
) {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [matchIndex, setMatchIndex] = createSignal(0);

  const matches = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (!q) return [];
    return messages().filter((m) => m.text.toLowerCase().includes(q));
  });

  let stopJump: (() => void) | undefined;
  const jump = (index: number) => {
    const list = matches();
    const el = container();
    if (!(list.length && el)) return;
    const wrapped = ((index % list.length) + list.length) % list.length;
    setMatchIndex(wrapped);
    stopJump?.();
    stopJump = jumpToMessageInContainer(el, list[wrapped].ts);
  };

  const close = () => {
    setOpen(false);
    setQuery("");
    setMatchIndex(0);
  };

  useShortcut({
    allowInInputs: true,
    allowRepeat: false,
    enabled: () => focusedPaneId() === paneId(),
    handler: () => setOpen(true),
    keys: "Ctrl/⌘ F",
    label: "Search in this view",
    match: (e) => (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "f",
    scope: "messages",
  });
  useEscapeClose(close, open);
  onCleanup(() => stopJump?.());

  return {
    close,
    goNext: () => jump(matchIndex() + 1),
    goPrev: () => jump(matchIndex() - 1),
    matchCount: () => matches().length,
    matchIndex,
    open,
    query,
    setQuery: (value: string) => {
      setQuery(value);
      jump(0);
    },
  };
}
