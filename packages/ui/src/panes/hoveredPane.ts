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
  window.addEventListener(
    "mouseup",
    (event) => {
      if (event.button === 3 || event.button === 4) lastPopWasMouseButton = true;
    },
    true,
  );
}

export function consumeMouseButtonPop() {
  const was = lastPopWasMouseButton;
  lastPopWasMouseButton = false;
  return was;
}

export { hoveredPaneId };
