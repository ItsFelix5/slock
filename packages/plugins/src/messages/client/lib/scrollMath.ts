export interface ScrollMetrics {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}

export type ScrollDirection = "newer" | "older";

interface HistoryAvailability {
  canLoadNewer: boolean;
  canLoadOlder: boolean;
}

const HISTORY_EDGE_VIEWPORTS = 2;

export function distanceFromBottom(metrics: ScrollMetrics) {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight;
}

export function scrollDirection(delta: number): ScrollDirection | undefined {
  return delta > 0 ? "newer" : delta < 0 ? "older" : undefined;
}

export function firstIndexWhere(length: number, predicate: (index: number) => boolean) {
  let low = 0;
  let high = length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (predicate(mid)) high = mid;
    else low = mid + 1;
  }
  return low;
}

export function historyLoadOnScroll(
  input: HistoryAvailability & {
    direction: ScrollDirection | undefined;
    metrics: ScrollMetrics;
  },
): ScrollDirection | undefined {
  const reach = input.metrics.clientHeight * HISTORY_EDGE_VIEWPORTS;
  if (input.direction === "newer")
    return input.canLoadNewer && distanceFromBottom(input.metrics) <= reach ? "newer" : undefined;
  return input.canLoadOlder && input.metrics.scrollTop <= reach ? "older" : undefined;
}

export function historyLoadToFillViewport(
  metrics: ScrollMetrics,
  availability: HistoryAvailability,
): ScrollDirection | undefined {
  if (metrics.clientHeight === 0 || metrics.scrollHeight > metrics.clientHeight) return;
  if (availability.canLoadOlder) return "older";
  return availability.canLoadNewer ? "newer" : undefined;
}
