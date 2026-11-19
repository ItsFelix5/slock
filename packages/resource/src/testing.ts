import type { ResourceEnv, TimerHandle } from "./env";

interface Timer {
  at: number;
  callback: () => void;
  id: number;
}

export interface FakeClock extends ResourceEnv {
  advance(ms: number): void;
  pending(): number;
}

export function createFakeClock(
  options: { random?: () => number; start?: number } = {},
): FakeClock {
  let time = options.start ?? 0;
  let nextId = 1;
  let timers: Timer[] = [];

  const advance = (ms: number) => {
    const target = time + ms;
    for (;;) {
      const [due] = timers
        .filter((timer) => timer.at <= target)
        .sort((a, b) => a.at - b.at || a.id - b.id);
      if (!due) break;
      timers = timers.filter((timer) => timer !== due);
      time = Math.max(time, due.at);
      due.callback();
    }
    time = target;
  };

  return {
    advance,
    clearTimeout: (handle: TimerHandle) => {
      timers = timers.filter((timer) => timer.id !== handle);
    },
    now: () => time,
    pending: () => timers.length,
    random: options.random ?? (() => 0.5),
    setTimeout: (callback, ms) => {
      const id = nextId++;
      timers.push({ at: time + Math.max(0, ms), callback, id });
      return id;
    },
  };
}

export function manualLoader<K, T>() {
  const calls: {
    key: K;
    reject(error: unknown): void;
    resolve(value: T): void;
    signal: AbortSignal;
  }[] = [];
  const load = (key: K, context: { signal: AbortSignal }) =>
    new Promise<T>((resolve, reject) => {
      calls.push({ key, reject, resolve, signal: context.signal });
    });
  return { calls, load };
}

export const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));

export async function settleMicrotasks(rounds = 5) {
  for (let round = 0; round < rounds; round++) await tick();
}
