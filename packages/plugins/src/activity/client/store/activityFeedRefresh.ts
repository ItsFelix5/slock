import type { Env, TimerHandle } from "@slock/core";

export function createActivityFeedRefreshScheduler({
  delayMs,
  env,
  isLoading,
  refresh,
}: {
  delayMs: number;
  env: Env;
  isLoading: () => boolean;
  refresh: () => Promise<void>;
}) {
  let pending = false;
  let timer: TimerHandle | undefined;

  const schedule = () => {
    if (timer) return;
    timer = env.setTimeout(async () => {
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
      env.clearTimeout(timer);
      timer = undefined;
    },
    request: () => {
      pending = true;
      schedule();
    },
  };
}
