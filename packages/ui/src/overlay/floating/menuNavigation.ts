export function menuNavigationIndex(
  key: string,
  current: number | null,
  itemCount: number,
): number | undefined {
  if (itemCount <= 0) return;
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  if (key === "ArrowDown") return current === null ? 0 : (current + 1) % itemCount;
  if (key === "ArrowUp")
    return current === null ? itemCount - 1 : (current - 1 + itemCount) % itemCount;
}
