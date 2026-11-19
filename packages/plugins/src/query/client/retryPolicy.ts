import { ApiError, isAuthError } from "@slock/slack";

const MAX_ATTEMPTS = 3;
const MAX_PLAIN_BACKOFF_MS = 1_000;
const RATE_LIMIT_FALLBACK_MS = 30_000;
const JITTER_MS = 2_000;
const RATE_LIMIT_MESSAGE = /rate_?limited/;
const DETERMINISTIC_ERROR =
  /^(channel_not_found|not_in_channel|is_archived|message_not_found|user_not_found|no_permission|access_denied|not_allowed|restricted_action|file_not_found|not_visible|enterprise_is_restricted|thread_not_found|team_not_found|bot_not_found|cant_.+|invalid_.+|missing_.+)$/;

function isAuthFailure(error: unknown): boolean {
  return error instanceof Error && isAuthError(error.message);
}

function isDeterministicFailure(error: unknown): boolean {
  return error instanceof Error && DETERMINISTIC_ERROR.test(error.message);
}

function isRateLimited(error: unknown): boolean {
  if (error instanceof ApiError && error.retryAfterMs !== undefined) return true;
  return error instanceof Error && RATE_LIMIT_MESSAGE.test(error.message);
}

export const shouldRetry = (failureCount: number, error: Error) =>
  failureCount < MAX_ATTEMPTS && !isAuthFailure(error) && !isDeterministicFailure(error);

export function createRetryPolicy() {
  let cooldownUntil = 0;
  return {
    retry: shouldRetry,
    retryDelay: (attemptIndex: number, error: Error) => {
      const now = Date.now();
      if (!isRateLimited(error)) return Math.min(1000 * 2 ** attemptIndex, MAX_PLAIN_BACKOFF_MS);
      const wait =
        (error instanceof ApiError ? error.retryAfterMs : undefined) ?? RATE_LIMIT_FALLBACK_MS;
      cooldownUntil = Math.max(cooldownUntil, now + wait) + Math.random() * JITTER_MS;
      return cooldownUntil - now;
    },
  };
}
