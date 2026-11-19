export type TimerHandle = number | object;

export interface ResourceEnv {
  clearTimeout(handle: TimerHandle): void;
  now(): number;
  random(): number;
  setTimeout(callback: () => void, ms: number): TimerHandle;
}

export function delay(env: ResourceEnv, ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const handle = env.setTimeout(done, ms);
    function done() {
      signal?.removeEventListener("abort", done);
      env.clearTimeout(handle);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}
