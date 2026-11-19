import type { Env } from "../types";
import { createFakeFetch, type FakeFetch } from "./fakeFetch";
import { createFakeTimers } from "./fakeTimers";
import { seededRandom } from "./seededRandom";

export type FakeEnv = Env & {
  fetch: FakeFetch;
  advance(ms: number): void;
  runAll(): void;
  pendingTimers(): number;
};

const DEFAULT_START = Date.UTC(2026, 0, 1, 12);

export function createFakeEnv(seed = 1, start = DEFAULT_START): FakeEnv {
  const timers = createFakeTimers(start);
  const data = new Map<string, string>();
  return {
    ...timers.api,
    advance: timers.advance,
    fetch: createFakeFetch(),
    pendingTimers: timers.pending,
    random: seededRandom(seed),
    runAll: timers.runAll,
    storage: {
      get: (key) => data.get(key) ?? null,
      remove: (key) => void data.delete(key),
      set: (key, value) => void data.set(key, value),
    },
  };
}
