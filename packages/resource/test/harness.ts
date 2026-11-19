import { createResourceCache } from "../src/cache";
import type { CacheOptions } from "../src/cacheTypes";
import { createFakeClock, manualLoader, settleMicrotasks } from "../src/testing";

export type HarnessOptions<T> = Partial<Omit<CacheOptions<string, T>, "env" | "load">> & {
  random?: () => number;
};

export function harness<T = string>(options: HarnessOptions<T> = {}) {
  const { random, ...cacheOptions } = options;
  const clock = createFakeClock({ random });
  const loader = manualLoader<string, T>();
  const cache = createResourceCache<string, T>({ env: clock, load: loader.load, ...cacheOptions });
  const flush = () => settleMicrotasks();
  return { cache, calls: loader.calls, clock, flush, load: loader.load };
}

export function observe<T>(
  subscribe: (listener: (state: { data: T | undefined; status: string }) => void) => () => void,
) {
  const seen: (T | undefined)[] = [];
  const stop = subscribe((state) => seen.push(state.data));
  return { seen, stop };
}
