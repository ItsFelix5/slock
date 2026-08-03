import { createSignal } from "solid-js";

const [viewportWidth, setViewportWidth] = createSignal(
  typeof window === "undefined" ? 1440 : window.innerWidth,
);

if (typeof window !== "undefined") {
  window.addEventListener("resize", () => setViewportWidth(window.innerWidth));
}

// Below this, the message list is too narrow to read comfortably.
const MIN_READABLE_MAIN_WIDTH = 400;

/** True once viewport minus the sidebar minus this panel would leave the
 * message list narrower than MIN_READABLE_MAIN_WIDTH — the panel should
 * cover the screen instead of squeezing it down further. */
export function panelWantsFullscreen(sidebarWidth: number, panelWidth: number) {
  return viewportWidth() - sidebarWidth - panelWidth < MIN_READABLE_MAIN_WIDTH;
}
