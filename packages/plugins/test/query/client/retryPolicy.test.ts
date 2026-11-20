import { describe, expect, test } from "bun:test";
import { networkError, slackErrorOf } from "@slock/slack";
import { retryPolicy, shouldRetry } from "../../../src/query/client/retryPolicy";

const classify = (error: unknown) => retryPolicy.classify?.(error);

describe("shouldRetry", () => {
  test("retries a transient failure until the third attempt", () => {
    const error = networkError(new Error("fetch failed"));
    expect(shouldRetry(0, error)).toBe(true);
    expect(shouldRetry(2, error)).toBe(true);
    expect(shouldRetry(3, error)).toBe(false);
  });

  test("never retries an auth failure", () => {
    expect(shouldRetry(0, slackErrorOf({ code: "invalid_auth", fallback: "x" }))).toBe(false);
  });

  test("never retries a deterministic Slack error", () => {
    expect(shouldRetry(0, slackErrorOf({ code: "channel_not_found", fallback: "x" }))).toBe(false);
    expect(shouldRetry(0, slackErrorOf({ code: "invalid_name", fallback: "x" }))).toBe(false);
  });
});

describe("retry policy classification", () => {
  test("plain failures back off and retry", () => {
    expect(classify(networkError(new Error("down")))).toBe("retry");
  });

  test("deterministic failures stop", () => {
    expect(classify(slackErrorOf({ code: "not_in_channel", fallback: "x" }))).toBe("stop");
  });

  test("honours Retry-After on a rate limit", () => {
    expect(classify(slackErrorOf({ code: "ratelimited", fallback: "x", retryAfter: "5" }))).toEqual(
      { retryAfterMs: 5000 },
    );
  });

  test("a rate limit without Retry-After waits about 30 seconds", () => {
    expect(classify(slackErrorOf({ code: "ratelimited", fallback: "x" }))).toEqual({
      retryAfterMs: 30_000,
    });
  });
});
