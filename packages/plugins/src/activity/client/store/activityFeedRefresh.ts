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

  return {
    cancel: () => {
      pending = false;
      clearTimeout(timer);
      timer = undefined;
    },
    request: () => {
      pending = true;
      schedule();
    },
  };
}
