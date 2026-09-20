import { ApiError } from "@slock/types";
import { QueryClient } from "@tanstack/solid-query";

const MAX_BACKOFF_DELAY_MS = 30_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Number.POSITIVE_INFINITY,
      retryDelay: (attemptIndex, error) =>
        error instanceof ApiError && error.retryAfterMs !== undefined
          ? error.retryAfterMs
          : Math.min(1000 * 2 ** attemptIndex, MAX_BACKOFF_DELAY_MS),
    },
  },
});
