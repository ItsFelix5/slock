import type { Env } from "@slock/core/types";

export function whenIdle(env: Pick<Env, "clearTimeout" | "setTimeout">, run: () => void) {
  if ("requestIdleCallback" in window) {
    const handle = window.requestIdleCallback(run, { timeout: 3000 });
    return () => window.cancelIdleCallback(handle);
  }
  const timer = env.setTimeout(run, 1000);
  return () => env.clearTimeout(timer);
}
