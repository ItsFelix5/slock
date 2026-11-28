import type { Env } from "../../../packages/core/src/types";
import { createFakeFetch, type FakeFetch } from "./fakeFetch";
import { createFakeTimers } from "./fakeTimers";
import { seededRandom } from "./seededRandom";

export type FakeEnv = Env & {
  fetch: FakeFetch;
  advance(ms: number): void;
  sleep(ms: number): void;
  runAll(): void;
  pendingTimers(): number;
  writeRemote(key: string, value: string | null): void;
};

const DEFAULT_START = Date.UTC(2026, 0, 1, 12);

export function createFakeEnv(seed = 1, start = DEFAULT_START): FakeEnv {
  const timers = createFakeTimers(start);
  const data = new Map<string, string>();
  const listeners = new Set<(key: string | null) => void>();
  return {
    ...timers.api,
    advance: timers.advance,
    sleep: timers.sleep,
    fetch: createFakeFetch(),
    pendingTimers: timers.pending,
    random: seededRandom(seed),
    runAll: timers.runAll,
    storage: {
      get: (key) => data.get(key) ?? null,
      remove: (key) => void data.delete(key),
      set: (key, value) => void data.set(key, value),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
    },
    writeRemote: (key, value) => {
      if (value === null) data.delete(key);
      else data.set(key, value);
      for (const listener of listeners) listener(key);
    },
  };
}
