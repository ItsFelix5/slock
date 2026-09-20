import type { CanvasListEntry } from "@slock/types";

const ORDERED_MARKER_TYPES = ["decimal", "lower-alpha", "lower-roman"] as const;
const BULLET_MARKER_TYPES = ["disc", "circle", "square"] as const;

export function orderedListMarkerType(indent: number): (typeof ORDERED_MARKER_TYPES)[number] {
  return ORDERED_MARKER_TYPES[indent % ORDERED_MARKER_TYPES.length] ?? "decimal";
}

export function bulletListMarkerType(indent: number): (typeof BULLET_MARKER_TYPES)[number] {
  return BULLET_MARKER_TYPES[indent % BULLET_MARKER_TYPES.length] ?? "disc";
}

export function orderedListEntries(
  items: CanvasListEntry[],
): (CanvasListEntry & { value: number })[] {
  const counters: number[] = [];
  return items.map((item) => {
    counters.length = item.indent + 1;
    counters[item.indent] = (counters[item.indent] ?? 0) + 1;
    return { ...item, value: counters[item.indent] };
  });
}
