export function longestIncreasing<T>(
  values: (T | null)[],
  isLess: (a: T, b: T) => boolean,
): Set<number> {
  const tails: number[] = [];
  const previous: number[] = new Array(values.length).fill(-1);
  values.forEach((value, index) => {
    if (value === null) return;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      const tail = values[tails[mid] ?? 0];
      if (tail !== null && tail !== undefined && isLess(tail, value)) low = mid + 1;
      else high = mid;
    }
    previous[index] = low > 0 ? (tails[low - 1] ?? -1) : -1;
    tails[low] = index;
  });
  const kept = new Set<number>();
  let cursor = tails.at(-1) ?? -1;
  while (cursor >= 0) {
    kept.add(cursor);
    cursor = previous[cursor] ?? -1;
  }
  return kept;
}
