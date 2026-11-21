const NEAR_BOTTOM_VIEWPORT_FRACTION = 1.5;
export const MAX_AUTO_TOP_UP_ATTEMPTS = 25;

type ScrollMetrics = { clientHeight: number; scrollHeight: number; scrollTop: number };

export type TopUpState = { attempts: number; key: string };

export function topUpStep(
  prev: TopUpState | undefined,
  key: string,
  metrics: ScrollMetrics | undefined,
): { load: boolean; state: TopUpState } {
  const attempts = prev?.key === key ? prev.attempts : 0;
  const reason = metrics && loadMoreReason(metrics, attempts);
  return {
    load: !!reason,
    state: { attempts: reason === "top-up" ? attempts + 1 : attempts, key },
  };
}

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
