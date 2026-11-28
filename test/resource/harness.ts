import { createResourceCache } from "../../packages/resource/src/cache";
import type { CacheOptions } from "../../packages/resource/src/cacheTypes";
import { createFakeClock, manualLoader, settleMicrotasks } from "../support/resource";

type HarnessOptions<T> = Partial<Omit<CacheOptions<string, T>, "env" | "load">> & {
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
