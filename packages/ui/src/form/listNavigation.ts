import { createEffect, createSignal } from "solid-js";

export type NavDirection = "down" | "end" | "left" | "right" | "start" | "up";
export type ListDirection = "down" | "end" | "start" | "up";

export function listNavigationIndex(
  direction: ListDirection,
  current: number | null,
  itemCount: number,
  options?: { wrap?: boolean },
): number | undefined {
  if (itemCount <= 0) return;
  const wrap = options?.wrap ?? false;
  if (direction === "down") {
    if (current === null) return 0;
    return wrap ? (current + 1) % itemCount : Math.min(current + 1, itemCount - 1);
  }
  if (direction === "up") {
    if (current === null) return itemCount - 1;
    return wrap ? (current - 1 + itemCount) % itemCount : Math.max(current - 1, 0);
  }
  if (direction === "start") return 0;
  if (direction === "end") return itemCount - 1;
}

export function gridNavigationIndex(
  direction: NavDirection,
  current: number | null,
  itemCount: number,
  columns: number,
): number | undefined {
  if (itemCount <= 0) return;
  if (direction === "start") return 0;
  if (direction === "end") return itemCount - 1;
  if (direction === "right") return current === null ? 0 : Math.min(current + 1, itemCount - 1);
  if (direction === "left") return current === null ? itemCount - 1 : Math.max(current - 1, 0);
  if (direction === "down")
    return current === null ? 0 : Math.min(current + columns, itemCount - 1);
  if (direction === "up") return current === null ? itemCount - 1 : Math.max(current - columns, 0);
}

export function rovingTabIndex(rows: HTMLElement[], activeIndex: number) {
  rows.forEach((row, index) => {
    row.tabIndex = index === activeIndex ? 0 : -1;
  });
}

export function scrollActiveListOption(listbox: () => HTMLElement | undefined) {
  queueMicrotask(() =>
    listbox()?.querySelector<HTMLElement>(".active")?.scrollIntoView({ block: "nearest" }),
  );
}

export function createListboxActiveIndex(
  itemCount: () => number,
  listboxId: string,
  listboxRef?: () => HTMLElement | undefined,
) {
  const [activeIndex, setActiveIndex] = createSignal<number | null>(0);

  createEffect(() => {
    const count = itemCount();
    const current = activeIndex();
    if (count === 0) setActiveIndex(null);
    else if (current === null || current >= count) setActiveIndex(0);
  });

  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const activeOptionId = () => {
    const index = activeIndex();
    return index === null ? undefined : optionId(index);
  };

  if (listboxRef) {
    createEffect(() => {
      activeIndex();
      scrollActiveListOption(listboxRef);
    });
  }

  return { activeIndex, setActiveIndex, optionId, activeOptionId };
}
