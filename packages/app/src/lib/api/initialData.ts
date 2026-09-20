import { ApiError, getOrCreateRetryablePromise } from "@slock/types";

export type InitialData = {
  channels?: any[];
  error?: Record<string, string>;
  retry_after?: Record<string, string>;
  ims?: any[];
  mpims?: any[];
  notifications?: any;
  sections?: Record<string, any>;
  self?: any;
  snooze?: { endtime?: number } | null;
  starred?: any[];
  subteams?: { all?: string[]; self?: string[] };
  unreads?: any;
  [key: string]: any;
};

const initialDataCache = new Map<"bootstrap", Promise<InitialData>>();

export function fetchInitialData(): Promise<InitialData> {
  return getOrCreateRetryablePromise(initialDataCache, "bootstrap", async () => {
    const response = await fetch("/api/bootstrap");
    if (!response.ok) {
      throw new ApiError(
        `Bootstrap failed (${response.status})`,
        response.headers.get("retry-after") ?? undefined,
      );
    }
    return response.json();
  });
}
