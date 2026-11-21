type ScrollMetrics = { clientHeight: number; scrollHeight: number; scrollTop: number };

export function isNearScrollEnd(metrics: ScrollMetrics, threshold: number): boolean {
  return metrics.scrollTop + metrics.clientHeight >= metrics.scrollHeight - threshold;
}
