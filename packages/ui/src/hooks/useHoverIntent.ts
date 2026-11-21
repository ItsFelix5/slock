import { service } from "@slock/core/solid";
import type { TimerHandle } from "@slock/core/types";
import { createSignal, onCleanup } from "solid-js";

const env = service("env");

export function useHoverIntent(openDelay = 350, closeDelay = 160) {
  const [open, setOpen] = createSignal(false);
  let openTimer: TimerHandle | undefined;
  let closeTimer: TimerHandle | undefined;

  const close = () => {
    env.clearTimeout(openTimer);
    env.clearTimeout(closeTimer);
    setOpen(false);
  };

  const scheduleOpen = () => {
    env.clearTimeout(openTimer);
    env.clearTimeout(closeTimer);
    openTimer = env.setTimeout(() => setOpen(true), openDelay);
  };
  const scheduleClose = () => {
    env.clearTimeout(openTimer);
    env.clearTimeout(closeTimer);
    closeTimer = env.setTimeout(close, closeDelay);
  };
  const cancelClose = () => env.clearTimeout(closeTimer);
  const openNow = () => {
    env.clearTimeout(openTimer);
    env.clearTimeout(closeTimer);
    setOpen(true);
  };

  onCleanup(() => {
    env.clearTimeout(openTimer);
    env.clearTimeout(closeTimer);
  });

  return { cancelClose, close, open, openNow, scheduleClose, scheduleOpen };
}
