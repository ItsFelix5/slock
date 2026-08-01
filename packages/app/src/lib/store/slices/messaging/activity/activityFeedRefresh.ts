const GATEWAY_ACTIVITY_COUNT_KEYS = [
  "at_user",
  "dm",
  "keyword",
  "list_user_mentioned",
  "at_user_group",
  "at_channel",
  "at_everyone",
  "channel",
  "thread_v2",
] as const;

export function gatewayActivityCountsSnapshot(activity: any): string {
  return GATEWAY_ACTIVITY_COUNT_KEYS.map((key) => Number(activity?.[key] ?? 0)).join(":");
}

export function createActivityFeedRefreshScheduler({
  delayMs,
  isLoaded,
  isLoading,
  refresh,
}: {
  delayMs: number;
  isLoaded: () => boolean;
  isLoading: () => boolean;
  refresh: () => Promise<void>;
}) {
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const request = () => {
    if (!isLoaded()) return;
    pending = true;
    if (isLoading() || timer) return;
    timer = setTimeout(async () => {
      timer = undefined;
      if (!pending) return;
      pending = false;
      await refresh();
      if (pending) request();
    }, delayMs);
  };

  return request;
}
