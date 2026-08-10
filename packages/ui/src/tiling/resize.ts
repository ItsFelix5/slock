// N-way generalization of layout/resizeMath.ts's resizeWidth: dragging the
// divider between two neighbors only ever trades size between that pair
// (VS Code editor-group semantics), clamped so neither shrinks past minFraction.
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
