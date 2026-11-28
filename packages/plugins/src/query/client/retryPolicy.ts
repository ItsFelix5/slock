import type { RetryDecision, RetryPolicy } from "@slock/resource";
import { isSlackError } from "@slock/slack";
import { retryDecision } from "./api/retryDecision";

const MAX_ATTEMPTS = 3;
const MAX_PLAIN_BACKOFF_MS = 1_000;
const RATE_LIMIT_FALLBACK_MS = 30_000;

export const shouldRetry = (failureCount: number, error: unknown) =>
  retryDecision(error, failureCount) === "retry";

function classify(error: unknown): RetryDecision {
  if (!shouldRetry(0, error)) return "stop";
  if (isSlackError(error) && error.kind === "rate_limited")
    return { retryAfterMs: error.retryAfterMs ?? RATE_LIMIT_FALLBACK_MS };
  return "retry";
}

export const retryPolicy: RetryPolicy = {
  baseMs: MAX_PLAIN_BACKOFF_MS,
  classify,
  maxMs: MAX_PLAIN_BACKOFF_MS,
  retries: MAX_ATTEMPTS,
};
