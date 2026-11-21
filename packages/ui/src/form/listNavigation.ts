import { assertNever } from "@slock/core";
import { createEffect, createSignal } from "solid-js";

export type NavDirection = "down" | "end" | "left" | "right" | "start" | "up";
export type ListDirection = "down" | "end" | "start" | "up";

function stepListIndex(
  direction: ListDirection,
  current: number | null,
  itemCount: number,
  wrap: boolean,
): number {
  switch (direction) {
    case "down":
      if (current === null) return 0;
      return wrap ? (current + 1) % itemCount : Math.min(current + 1, itemCount - 1);
    case "up":
      if (current === null) return itemCount - 1;
      return wrap ? (current - 1 + itemCount) % itemCount : Math.max(current - 1, 0);
    case "start":
      return 0;
    case "end":
      return itemCount - 1;
    default:
      return assertNever(direction);
  }
}

export function listNavigationIndex(
  direction: ListDirection,
  current: number | null,
  itemCount: number,
  options?: { wrap?: boolean },
): number | undefined {
  return itemCount > 0
    ? stepListIndex(direction, current, itemCount, options?.wrap ?? false)
    : undefined;
}

function stepGridIndex(
  direction: NavDirection,
  current: number | null,
  itemCount: number,
  columns: number,
): number {
  switch (direction) {
    case "start":
      return 0;
    case "end":
      return itemCount - 1;
    case "right":
      return current === null ? 0 : Math.min(current + 1, itemCount - 1);
    case "left":
      return current === null ? itemCount - 1 : Math.max(current - 1, 0);
    case "down":
      return current === null ? 0 : Math.min(current + columns, itemCount - 1);
    case "up":
      return current === null ? itemCount - 1 : Math.max(current - columns, 0);
    default:
      return assertNever(direction);
  }
}

export function gridNavigationIndex(
  direction: NavDirection,
  current: number | null,
  itemCount: number,
  columns: number,
): number | undefined {
  return itemCount > 0 ? stepGridIndex(direction, current, itemCount, columns) : undefined;
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
  const [selected, setActiveIndex] = createSignal<number | null>(0);

  const activeIndex = () => {
    const count = itemCount();
    const current = selected();
    if (count === 0) return null;
    return current === null || current >= count ? 0 : current;
  };

  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const activeOptionId = () => {
    const index = activeIndex();
    return index === null ? undefined : optionId(index);
  };

  if (listboxRef) {
    createEffect(activeIndex, () => void scrollActiveListOption(listboxRef));
  }

  return { activeIndex, setActiveIndex, optionId, activeOptionId };
}
