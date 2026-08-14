import { createSignal } from "solid-js";

const [hoveredPaneId, setHoveredPaneId] = createSignal<string | null>(null);

let lastPopWasMouseButton = false;

if (typeof document !== "undefined") {
  document.addEventListener(
    "mouseover",
    (event) => {
      const pane = (event.target as Element | null)?.closest<HTMLElement>("[data-pane]");
      setHoveredPaneId(pane?.dataset.pane ?? null);
    },
    true,
  );
  document.addEventListener("mouseout", (event) => {
    const related = event.relatedTarget as Element | null;
    if (!related?.closest("[data-pane]")) setHoveredPaneId(null);
  });
  // browsers dispatch mouseup for the side (back/forward) buttons before performing
  // the native navigation, so this reliably fires just ahead of the popstate it causes
  window.addEventListener(
    "mouseup",
    (event) => {
      if (event.button === 3 || event.button === 4) lastPopWasMouseButton = true;
    },
    true,
  );
}

export function consumeMouseButtonPop(): boolean {
  const was = lastPopWasMouseButton;
  lastPopWasMouseButton = false;
  return was;
}

export { hoveredPaneId };
