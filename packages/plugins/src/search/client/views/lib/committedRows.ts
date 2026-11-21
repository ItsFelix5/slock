import { createEffect, createSignal, untrack } from "solid-js";
import { submitIntent } from "./submitIntent";

export const MESSAGE_SEARCH_INDEX = 0;

export function firstResultIndex(rowCount: number): number {
  return rowCount > 0 ? MESSAGE_SEARCH_INDEX + 1 : MESSAGE_SEARCH_INDEX;
}

export function createCommittedRows<Row>(deps: {
  hasQuery: () => boolean;
  searching: () => boolean;
  ranked: () => Row[];
  onCommit: (selectedIndex: number) => void;
  onSubmit: (index: number) => void;
}) {
  const [rows, setRows] = createSignal<Row[]>([]);
  let submitQueued = false;

  createEffect(
    () => deps.hasQuery() && !deps.searching(),
    (settled) => {
      if (!settled) return;
      const ranked = untrack(deps.ranked);
      const selected = firstResultIndex(ranked.length);
      setRows(ranked);
      deps.onCommit(selected);
      if (submitQueued) {
        submitQueued = false;
        deps.onSubmit(selected);
      }
    },
  );

  return {
    restart() {
      setRows([]);
      submitQueued = false;
    },
    rows,
    submit(activeIndex: number | null) {
      const intent = submitIntent({
        activeIndex,
        hasQuery: deps.hasQuery(),
        rowCount: rows().length,
        searching: deps.searching(),
      });
      if (intent.kind === "queue") submitQueued = true;
      else if (intent.kind === "open") deps.onSubmit(intent.index);
    },
  };
}
