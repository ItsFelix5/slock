type Span = { left: number; width: number };
type Viewport = { scrollLeft: number; width: number };

export function scrollLeftToReveal(cell: Span, viewport: Viewport): number | undefined {
  const right = cell.left + cell.width;
  if (cell.left >= viewport.scrollLeft && right <= viewport.scrollLeft + viewport.width) return;
  return cell.left - (viewport.width - cell.width) / 2;
}
