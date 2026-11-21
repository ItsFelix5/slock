export interface BubbleBounds {
  bottom: number;
  top: number;
}

export function bubbleFits(
  bounds: BubbleBounds,
  format: Record<string, unknown>,
  containerHeight: number,
): boolean {
  return !format["code-block"] && bounds.top >= 0 && bounds.bottom <= containerHeight;
}
