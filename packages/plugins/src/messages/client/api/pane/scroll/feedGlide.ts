const GLIDE_TAU_MS = 70;
const ARRIVED_PX = 0.5;
const SNAP_VIEWPORTS = 3;
const SNAP_REMAINING_VIEWPORTS = 1.5;

export const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function glideStep(distance: number, elapsedMs: number) {
  if (Math.abs(distance) <= ARRIVED_PX) return distance;
  return distance * (1 - Math.exp(-elapsedMs / GLIDE_TAU_MS));
}

export function glideSnap(distance: number, viewport: number) {
  if (Math.abs(distance) <= viewport * SNAP_VIEWPORTS) return 0;
  return distance - Math.sign(distance) * viewport * SNAP_REMAINING_VIEWPORTS;
}

export function createGlide(frame: (elapsedMs: number) => boolean) {
  let handle = 0;
  let last = 0;

  const tick = (now: number) => {
    const elapsed = now - last;
    last = now;
    handle = frame(elapsed) ? 0 : requestAnimationFrame(tick);
  };

  return {
    active: () => handle !== 0,
    start() {
      if (handle) return;
      last = performance.now();
      handle = requestAnimationFrame(tick);
    },
    stop() {
      cancelAnimationFrame(handle);
      handle = 0;
    },
  };
}
