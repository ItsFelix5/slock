import { createEffect, createSignal } from "solid-js";

export function listNavigationIndex(
  key: string,
  current: number | null,
  itemCount: number,
  options?: { wrap?: boolean },
): number | undefined {
  if (itemCount <= 0) return;
  const wrap = options?.wrap ?? false;
  if (key === "ArrowDown") {
    if (current === null) return 0;
    return wrap ? (current + 1) % itemCount : Math.min(current + 1, itemCount - 1);
  }
  if (key === "ArrowUp") {
    if (current === null) return itemCount - 1;
    return wrap ? (current - 1 + itemCount) % itemCount : Math.max(current - 1, 0);
  }
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
}

export function gridNavigationIndex(
  key: string,
  current: number | null,
  itemCount: number,
  columns: number,
): number | undefined {
  if (itemCount <= 0) return;
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  if (key === "ArrowRight") return current === null ? 0 : Math.min(current + 1, itemCount - 1);
  if (key === "ArrowLeft") return current === null ? itemCount - 1 : Math.max(current - 1, 0);
  if (key === "ArrowDown") return current === null ? 0 : Math.min(current + columns, itemCount - 1);
  if (key === "ArrowUp") return current === null ? itemCount - 1 : Math.max(current - columns, 0);
}

export function scrollActiveListOption(listbox: () => HTMLElement | undefined) {
  queueMicrotask(() =>
    listbox()
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" }),
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
