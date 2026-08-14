import { createSignal } from "solid-js";

const [focusedPaneId, setFocusedPaneId] = createSignal<string | null>(null);

if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (event) => {
      const pane = (event.target as Element | null)?.closest<HTMLElement>("[data-pane]");
      if (pane?.dataset.pane) setFocusedPaneId(pane.dataset.pane);
    },
    true,
  );
}

export { focusedPaneId };
