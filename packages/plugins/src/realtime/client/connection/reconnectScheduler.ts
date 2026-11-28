import type { Env, TimerHandle } from "@slock/core";
import { backoff } from "../../protocol/backoff";

const JITTER = 0.3;

export function createReconnectScheduler(opts: {
  connect: () => void;
  env: Env;
  isOnline: () => boolean;
  initialDelay?: number;
  maxDelay?: number;
}) {
  const base = opts.initialDelay ?? 1000;
  const max = opts.maxDelay ?? 20000;
  let attempt = 0;
  let disposed = false;
  let timer: TimerHandle | undefined;

  const cancel = () => {
    opts.env.clearTimeout(timer);
    timer = undefined;
  };

  return {
    connected() {
      cancel();
      attempt = 0;
    },
    dispose() {
      disposed = true;
      cancel();
    },
    pause: cancel,
    reconnectNow() {
      cancel();
      if (!(disposed || !opts.isOnline())) opts.connect();
    },
    schedule() {
      if (disposed || timer !== undefined || !opts.isOnline()) return;
      const wait = backoff(attempt++, {
        base,
        factor: 1.7,
        jitter: JITTER,
        max,
        random: opts.env.random,
      });
      timer = opts.env.setTimeout(() => {
        timer = undefined;
        if (!(disposed || !opts.isOnline())) opts.connect();
      }, wait);
      return wait;
    },
  };
}
