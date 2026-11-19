import { delay, type ResourceEnv } from "./env";

export interface Cooldown {
  active(): boolean;
  pause(ms: number): void;
  wait(signal?: AbortSignal): Promise<void>;
}

export function createCooldown(env: ResourceEnv, options: { jitterMs?: number } = {}): Cooldown {
  const jitterMs = options.jitterMs ?? 2_000;
  let until = 0;

  const remaining = () => until - env.now();

  return {
    active: () => remaining() > 0,
    pause: (ms) => {
      until = Math.max(until, env.now() + ms + env.random() * jitterMs);
    },
    wait: async (signal) => {
      while (remaining() > 0 && !signal?.aborted) await delay(env, remaining(), signal);
    },
  };
}
