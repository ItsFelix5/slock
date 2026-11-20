export const NEAR_BOTTOM_VIEWPORT_FRACTION = 1.5;
export const MAX_AUTO_TOP_UP_ATTEMPTS = 25;

type ScrollMetrics = { clientHeight: number; scrollHeight: number; scrollTop: number };

export function loadMoreReason(
  metrics: ScrollMetrics,
  topUpAttempts: number,
): "near-bottom" | "top-up" | undefined {
  if (metrics.scrollHeight <= metrics.clientHeight)
    return topUpAttempts < MAX_AUTO_TOP_UP_ATTEMPTS ? "top-up" : undefined;
  const distance = metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight;
  return distance <= metrics.clientHeight * NEAR_BOTTOM_VIEWPORT_FRACTION
    ? "near-bottom"
    : undefined;
}
