type Span = { left: number; width: number };
type Viewport = { scrollLeft: number; width: number };

export function scrollLeftToReveal(cell: Span, viewport: Viewport): number | undefined {
  const overflowRight = cell.left + cell.width - (viewport.scrollLeft + viewport.width);
  if (cell.left < viewport.scrollLeft) return cell.left;
  return overflowRight > 0 ? viewport.scrollLeft + overflowRight : undefined;
}
