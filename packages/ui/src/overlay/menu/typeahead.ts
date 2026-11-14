const TYPEAHEAD_RESET_MS = 500;

export interface TypeaheadState {
  buffer: string;
  time: number;
}

export function pushTypeahead(state: TypeaheadState, key: string, time: number): TypeaheadState {
  const fresh = time - state.time > TYPEAHEAD_RESET_MS;
  return { buffer: (fresh ? "" : state.buffer) + key.toLowerCase(), time };
}

export function isTypeaheadKey(
  event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey">,
) {
  return (
    event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}

export function typeaheadIndex(
  labels: readonly string[],
  query: string,
  currentIndex: number,
): number | undefined {
  if (labels.length === 0 || query === "") return;
  const first = query.charAt(0);
  const cycling = [...query].every((char) => char === first);
  const needle = cycling ? first : query;
  const start = cycling ? currentIndex + 1 : Math.max(currentIndex, 0);
  for (let offset = 0; offset < labels.length; offset++) {
    const index = (start + offset) % labels.length;
    if (labels[index]?.trim().toLowerCase().startsWith(needle)) return index;
  }
}
