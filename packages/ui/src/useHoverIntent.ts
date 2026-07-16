import { createSignal, onCleanup } from "solid-js";

// Delayed open/close so a hover card doesn't flash while the pointer is just
// passing through, but still closes promptly once the pointer actually leaves.
export function useHoverIntent(openDelay = 350, closeDelay = 160) {
  const [open, setOpen] = createSignal(false);
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleOpen = () => {
    clearTimeout(closeTimer);
    openTimer = setTimeout(() => setOpen(true), openDelay);
  };
  const scheduleClose = () => {
    clearTimeout(openTimer);
    closeTimer = setTimeout(() => setOpen(false), closeDelay);
  };
  const cancelClose = () => clearTimeout(closeTimer);
  const close = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    setOpen(false);
  };

  onCleanup(() => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
  });

  return { cancelClose, close, open, scheduleClose, scheduleOpen };
}
