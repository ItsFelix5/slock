import { describe, expect, test } from "bun:test";
import { ApiError } from "@slock/slack";
import { createRetryPolicy, shouldRetry } from "../../../src/query/client/retryPolicy";

describe("shouldRetry", () => {
  test("retries a transient failure until the third attempt", () => {
    const error = new Error("fetch failed");
    expect(shouldRetry(0, error)).toBe(true);
    expect(shouldRetry(2, error)).toBe(true);
    expect(shouldRetry(3, error)).toBe(false);
  });

  test("never retries an auth failure", () => {
    expect(shouldRetry(0, new Error("invalid_auth"))).toBe(false);
  });

  test("never retries a deterministic Slack error", () => {
    expect(shouldRetry(0, new Error("channel_not_found"))).toBe(false);
    expect(shouldRetry(0, new Error("invalid_name"))).toBe(false);
  });
});

describe("retryDelay", () => {
  test("waits one second for a failure that is not a rate limit", () => {
    const policy = createRetryPolicy();
    expect(policy.retryDelay(0, new Error("fetch failed"))).toBe(1000);
    expect(policy.retryDelay(4, new Error("fetch failed"))).toBe(1000);
  });

  test("honours Retry-After on a rate limit, plus jitter", () => {
    const policy = createRetryPolicy();
    const delay = policy.retryDelay(0, new ApiError("ratelimited", "5"));
    expect(delay).toBeGreaterThanOrEqual(5000);
    expect(delay).toBeLessThan(7000);
  });

  test("a rate limit without Retry-After waits about 30 seconds", () => {
    const policy = createRetryPolicy();
    const delay = policy.retryDelay(0, new Error("ratelimited"));
    expect(delay).toBeGreaterThanOrEqual(30_000);
    expect(delay).toBeLessThan(32_000);
  });
});
