export function firstTruthy<T, R>(
  items: readonly T[],
  pick: (item: T) => R | undefined,
): R | undefined {
  return items.reduce<R | undefined>((found, item) => found || pick(item), undefined);
}
