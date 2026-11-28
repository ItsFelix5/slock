import { useDebouncer } from "@slock/core/solid";
import { createSignal } from "solid-js";

export function useHoverIntent(openDelay = 350, closeDelay = 160) {
  const [open, setOpen] = createSignal(false);
  const opening = useDebouncer(() => setOpen(true), openDelay);
  const closing = useDebouncer(() => setOpen(false), closeDelay);

  const close = () => {
    opening.cancel();
    closing.cancel();
    setOpen(false);
  };

  const scheduleOpen = () => {
    closing.cancel();
    opening.schedule();
  };
  const scheduleClose = () => {
    opening.cancel();
    closing.schedule();
  };
  const cancelClose = () => closing.cancel();
  const openNow = () => {
    opening.cancel();
    closing.cancel();
    setOpen(true);
  };

  // Presses inside a portal panel bubble to the anchor too, hence contains.
  const closeOnPress = (event: Event & { currentTarget: Element }) => {
    if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;
    if (event.target instanceof Node && event.currentTarget.contains(event.target)) close();
  };

  return { cancelClose, close, closeOnPress, open, openNow, scheduleClose, scheduleOpen };
}
