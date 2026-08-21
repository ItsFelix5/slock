import { type Accessor, createEffect, createSignal } from "solid-js";
import { rovingTabIndex } from "../form/listNavigation";
import { plainKey, useShortcut } from "../useShortcut";

export function initRovingTabIndexDefault(
  container: Accessor<HTMLElement | undefined>,
  dep: Accessor<unknown>,
) {
  createEffect(() => {
    dep();
    queueMicrotask(() => {
      const rows = [...(container()?.querySelectorAll<HTMLElement>("[data-nav-row]") ?? [])];
      if (rows.length && !rows.some((row) => row.tabIndex === 0)) rovingTabIndex(rows, 0);
    });
  });
}

export function createRovingFocus<T>(items: Accessor<T[]>, key: (item: T) => string) {
  const [focusedKey, setFocusedKey] = createSignal<string | null>(null);
  const [listFocused, setListFocused] = createSignal(false);
  let containerRef: HTMLElement | undefined;

  createEffect(() => {
    const list = items();
    const current = focusedKey();
    if (!list.length) {
      if (current !== null) setFocusedKey(null);
      return;
    }
    if (current === null || !list.some((item) => key(item) === current)) {
      setFocusedKey(key(list[0]));
    }
  });

  function rowFor(k: string) {
    return containerRef?.querySelector<HTMLElement>(
      `[data-nav-row][data-row-key="${CSS.escape(k)}"]`,
    );
  }

  function focusRow(k: string) {
    setFocusedKey(k);
    const row = rowFor(k);
    row?.focus();
    row?.scrollIntoView({ block: "nearest" });
  }

  function moveFocus(delta: number) {
    const list = items();
    if (!list.length) return;
    const currentIndex = list.findIndex((item) => key(item) === focusedKey());
    const nextIndex = Math.max(
      0,
      Math.min(list.length - 1, currentIndex < 0 ? 0 : currentIndex + delta),
    );
    focusRow(key(list[nextIndex]));
  }

  useShortcut({
    allowRepeat: true,
    enabled: () => listFocused() && focusedKey() !== null,
    handler: (e) => {
      const list = items();
      if (!list.length) return;
      if (e.key === "Home") {
        focusRow(key(list[0]));
        return;
      }
      if (e.key === "End") {
        focusRow(key(list[list.length - 1]));
        return;
      }
      moveFocus(e.key === "ArrowDown" ? 1 : -1);
    },
    keys: "↑ / ↓",
    label: "Move between list items",
    match: plainKey("ArrowDown", "ArrowUp", "Home", "End"),
    scope: "general",
  });

  return {
    focusedKey,
    rowProps: (k: string) => ({
      "data-row-key": k,
      tabIndex: focusedKey() === k ? 0 : -1,
    }),
    setContainerRef: (el: HTMLElement | undefined) => {
      containerRef = el;
    },
    onContainerFocusIn: (e: FocusEvent) => {
      setListFocused(true);
      const k = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-nav-row]")?.dataset
        .rowKey;
      if (k) setFocusedKey(k);
    },
    onContainerFocusOut: (e: FocusEvent) => {
      const el = e.currentTarget as HTMLElement;
      if (!(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) {
        setListFocused(false);
      }
    },
  };
}
