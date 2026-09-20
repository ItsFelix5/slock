import { createSignal, onCleanup } from "solid-js";

export function useHoverIntent(openDelay = 350, closeDelay = 160) {
  const [open, setOpen] = createSignal(false);
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const close = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    setOpen(false);
  };

  const scheduleOpen = () => {
    clearTimeout(closeTimer);
    openTimer = setTimeout(() => setOpen(true), openDelay);
  };
  const scheduleClose = () => {
    clearTimeout(openTimer);
    closeTimer = setTimeout(close, closeDelay);
  };
  const cancelClose = () => clearTimeout(closeTimer);
  const openNow = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    setOpen(true);
  };

  onCleanup(() => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
  });

  return { cancelClose, close, open, openNow, scheduleClose, scheduleOpen };
}
