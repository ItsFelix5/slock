import { createSignal } from "solid-js";

const [viewportWidth, setViewportWidth] = createSignal(
  typeof window === "undefined" ? 1440 : window.innerWidth,
);

if (typeof window !== "undefined") {
  window.addEventListener("resize", () => setViewportWidth(window.innerWidth));
}

const MIN_READABLE_MAIN_WIDTH = 400;

export function panelWantsFullscreen(sidebarWidth: number, panelWidth: number) {
  return viewportWidth() - sidebarWidth - panelWidth < MIN_READABLE_MAIN_WIDTH;
}
