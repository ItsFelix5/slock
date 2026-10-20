import { ApiError, isAuthError } from "@slock/slack";

const MAX_ATTEMPTS = 3;
const MAX_BACKOFF_MS = 30_000;
const RATE_LIMIT_FALLBACK_MS = 30_000;
const JITTER_MS = 2_000;
const RATE_LIMIT_MESSAGE = /rate_?limited/;
function isAuthFailure(error: unknown): boolean {
  return error instanceof Error && isAuthError(error.message);
}

function isRateLimited(error: unknown): boolean {
  if (error instanceof ApiError && error.retryAfterMs !== undefined) return true;
  return error instanceof Error && RATE_LIMIT_MESSAGE.test(error.message);
}

export function createRetryPolicy() {
  let cooldownUntil = 0;
  return {
    retry: (failureCount: number, error: Error) =>
      failureCount < MAX_ATTEMPTS && !isAuthFailure(error),
    retryDelay: (attemptIndex: number, error: Error) => {
      const now = Date.now();
      if (!isRateLimited(error)) return Math.min(1000 * 2 ** attemptIndex, MAX_BACKOFF_MS);
      const wait =
        (error instanceof ApiError ? error.retryAfterMs : undefined) ?? RATE_LIMIT_FALLBACK_MS;
      cooldownUntil = Math.max(cooldownUntil, now + wait) + Math.random() * JITTER_MS;
      return cooldownUntil - now;
    },
  };
}
