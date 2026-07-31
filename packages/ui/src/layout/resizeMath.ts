export function resizeWidth(
  width: number,
  pointerDelta: number,
  direction: 1 | -1,
  min: number,
  max: number,
) {
  return Math.min(max, Math.max(min, width + pointerDelta * direction));
}
