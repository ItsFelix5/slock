import type { BootstrapPayload } from "@slock/types";
import { ApiError, forceReauth, getOrCreateRetryablePromise, isConfigured } from "@slock/types";

const initialDataCache = new Map<"bootstrap", Promise<BootstrapPayload>>();

export function fetchInitialData(): Promise<BootstrapPayload> {
  return getOrCreateRetryablePromise(initialDataCache, "bootstrap", async () => {
    const response = await fetch("/api/bootstrap");
    if (!response.ok) {
      throw new ApiError(
        `Bootstrap failed (${response.status})`,
        response.headers.get("retry-after") ?? undefined,
      );
    }
    const data: BootstrapPayload = await response.json();
    if (isConfigured() && Object.values(data.error ?? {}).includes("not_configured")) {
      return forceReauth();
    }
    if (Object.keys(data.error ?? {}).length) initialDataCache.delete("bootstrap");
    return data;
  });
}
