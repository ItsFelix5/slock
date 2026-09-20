import { createSignal } from "solid-js";

const [hoveredPaneId, setHoveredPaneId] = createSignal<string | null>(null);

let lastPopWasMouseButton = false;

if (typeof document !== "undefined") {
  document.addEventListener(
    "mouseover",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const pane = target?.closest<HTMLElement>("[data-pane]");
      setHoveredPaneId(pane?.dataset.pane ?? null);
    },
    true,
  );
  document.addEventListener("mouseout", (event) => {
    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
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
