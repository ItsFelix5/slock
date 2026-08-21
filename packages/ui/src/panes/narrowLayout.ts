import { createSignal, onCleanup } from "solid-js";

const NARROW_PANE_ROW_QUERY = "(max-width: 860px)";

export function useNarrowPaneRow(): () => boolean {
  const query = window.matchMedia(NARROW_PANE_ROW_QUERY);
  const [narrow, setNarrow] = createSignal(query.matches);
  const onChange = () => setNarrow(query.matches);
  query.addEventListener("change", onChange);
  onCleanup(() => query.removeEventListener("change", onChange));
  return narrow;
}
