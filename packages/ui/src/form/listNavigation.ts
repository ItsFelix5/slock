export function listNavigationIndex(
  key: string,
  current: number | null,
  itemCount: number,
): number | undefined {
  if (itemCount <= 0) return;
  if (key === "ArrowDown") return current === null ? 0 : Math.min(current + 1, itemCount - 1);
  if (key === "ArrowUp") return current === null ? itemCount - 1 : Math.max(current - 1, 0);
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
}

export function scrollActiveListOption(listbox: () => HTMLElement | undefined) {
  queueMicrotask(() =>
    listbox()
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" }),
  );
}
