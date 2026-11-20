import { createSignal } from "solid-js";

export function createFocusedPane() {
  const [focusedPaneId, setFocusedPaneId] = createSignal<string | null>(null);
  const onFocusIn = (event: FocusEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const pane = target?.closest<HTMLElement>("[data-pane]");
    if (pane?.dataset.pane) setFocusedPaneId(pane.dataset.pane);
  };
  document.addEventListener("focusin", onFocusIn, true);
  return {
    dispose: () => document.removeEventListener("focusin", onFocusIn, true),
    focusedPaneId,
  };
}
