export type SubmitIntent = { kind: "queue" } | { kind: "open"; index: number } | { kind: "ignore" };

export function submitIntent(state: {
  hasQuery: boolean;
  searching: boolean;
  rowCount: number;
  activeIndex: number | null;
}): SubmitIntent {
  if (state.hasQuery && state.searching && state.rowCount === 0) return { kind: "queue" };
  return state.activeIndex === null
    ? { kind: "ignore" }
    : { index: state.activeIndex, kind: "open" };
}
