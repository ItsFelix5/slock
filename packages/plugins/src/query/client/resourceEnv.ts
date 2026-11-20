import type { Env } from "@slock/core/types";
import type { ResourceEnv } from "@slock/resource";

type CoreHandle = ReturnType<Env["setTimeout"]>;

function isCoreHandle(handle: unknown): handle is CoreHandle {
  return (
    typeof handle === "object" &&
    handle !== null &&
    "cancel" in handle &&
    typeof handle.cancel === "function"
  );
}

export function toResourceEnv(env: Env): ResourceEnv {
  return {
    clearTimeout: (handle) => {
      if (isCoreHandle(handle)) env.clearTimeout(handle);
    },
    now: () => env.now(),
    random: () => env.random(),
    setTimeout: (callback, ms) => env.setTimeout(callback, ms),
  };
}
