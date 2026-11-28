import type { Env, TimerHandle } from "../types";

export interface Debouncer<A extends unknown[]> {
  cancel(): void;
  flush(): void;
  pending(): boolean;
  schedule(...args: A): void;
}

export function createDebouncer<A extends unknown[]>(
  env: Pick<Env, "clearTimeout" | "setTimeout">,
  run: (...args: A) => void,
  ms: number,
): Debouncer<A> {
  let queued: { args: A } | undefined;
  let timer: TimerHandle | undefined;

  const cancel = () => {
    if (timer !== undefined) env.clearTimeout(timer);
    timer = undefined;
    queued = undefined;
  };

  const flush = () => {
    const due = queued;
    cancel();
    if (due) run(...due.args);
  };

  return {
    cancel,
    flush,
    pending: () => queued !== undefined,
    schedule: (...args) => {
      cancel();
      queued = { args };
      timer = env.setTimeout(flush, ms);
    },
  };
}
