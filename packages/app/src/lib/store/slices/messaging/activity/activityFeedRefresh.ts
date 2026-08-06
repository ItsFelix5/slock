export function gatewayActivityCountsSnapshot(activity: any): string {
  if (!activity || typeof activity !== "object") return "";
  return Object.entries(activity)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${Number(value) || 0}`)
    .join(":");
}

export function createActivityFeedRefreshScheduler({
  delayMs,
  isLoading,
  refresh,
}: {
  delayMs: number;
  isLoading: () => boolean;
  refresh: () => Promise<void>;
}) {
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    if (timer) return;
    timer = setTimeout(async () => {
      timer = undefined;
      if (!pending) return;
      if (isLoading()) {
        schedule();
        return;
      }
      pending = false;
      await refresh();
      if (pending) schedule();
    }, delayMs);
  };

  const request = () => {
    pending = true;
    schedule();
  };

  return request;
}
