export function distributeResize(
  sizes: number[],
  index: number,
  deltaFraction: number,
  minFraction: number,
): number[] {
  if (index < 0 || index + 1 >= sizes.length) return sizes;
  const a = sizes[index];
  const b = sizes[index + 1];
  const delta = Math.max(minFraction - a, Math.min(b - minFraction, deltaFraction));
  const next = [...sizes];
  next[index] = a + delta;
  next[index + 1] = b - delta;
  return next;
}
