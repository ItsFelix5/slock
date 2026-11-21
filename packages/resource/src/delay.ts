import type { Env } from "@slock/core/types";

export type ResourceEnv = Pick<Env, "clearTimeout" | "now" | "random" | "setTimeout">;

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
