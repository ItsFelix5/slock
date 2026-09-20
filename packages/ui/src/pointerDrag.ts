export function startFrameCoalescedPointerDrag(
  onMove: (event: PointerEvent) => void,
  onEnd?: () => void,
) {
  let frame: number | undefined;
  let latest: PointerEvent | undefined;

  const flush = () => {
    frame = undefined;
    if (latest) onMove(latest);
  };

  const handleMove = (event: PointerEvent) => {
    latest = event;
    frame ??= requestAnimationFrame(flush);
  };

  const stop = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
    window.removeEventListener("blur", stop);
    onEnd?.();
  };

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  window.addEventListener("blur", stop);

  return stop;
}
