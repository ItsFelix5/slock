import { createFakeEnv, type FakeEnv } from "@slock/core/testing";

export function createFakeClock(options: { random?: () => number } = {}): FakeEnv {
  return { ...createFakeEnv(1, 0), random: options.random ?? (() => 0.5) };
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
