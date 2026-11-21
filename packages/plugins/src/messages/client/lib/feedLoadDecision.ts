import {
  historyLoadOnScroll,
  historyLoadToFillViewport,
  type ScrollDirection,
  type ScrollMetrics,
} from "./scrollMath";

export interface FeedLoadInput {
  availability: { canLoadNewer: boolean; canLoadOlder: boolean };
  direction: ScrollDirection | undefined;
  lastLoad: ScrollDirection | undefined;
  metrics: ScrollMetrics;
  size: number;
  sizeAtLayoutLoad: number | undefined;
}

function layoutLoad({ availability, lastLoad, metrics }: FeedLoadInput) {
  const edge =
    historyLoadOnScroll({ ...availability, direction: undefined, metrics }) ??
    historyLoadOnScroll({ ...availability, direction: "newer", metrics });
  if (edge && (lastLoad === undefined || edge === lastLoad)) return edge;
  return historyLoadToFillViewport(metrics, availability);
}

export function nextFeedLoad(input: FeedLoadInput): ScrollDirection | undefined {
  if (input.direction)
    return historyLoadOnScroll({
      ...input.availability,
      direction: input.direction,
      metrics: input.metrics,
    });
  if (input.size === input.sizeAtLayoutLoad) return;
  return layoutLoad(input);
}
