import { describe, expect, test } from "bun:test";
import type { SlackErrorKind } from "../src/error";
import {
  isAuthError,
  isSlackError,
  networkError,
  replyError,
  retryDecision,
  SlackError,
  slackErrorOf,
} from "../src/error";

describe("slackErrorOf", () => {
  test.each<[string, SlackErrorKind]>([
    ["invalid_auth", "auth"],
    ["token_revoked", "auth"],
    ["channel_not_found", "deterministic"],
    ["not_in_channel", "deterministic"],
    ["cant_invite_self", "deterministic"],
    ["invalid_name", "deterministic"],
    ["missing_scope", "deterministic"],
    ["ratelimited", "rate_limited"],
    ["rate_limited", "rate_limited"],
    ["internal_error", "transient"],
    ["fatal_error", "transient"],
  ])("%s is %s", (code, kind) => {
    const error = slackErrorOf({ code, fallback: "x" });
    expect(error.kind).toBe(kind);
    expect(error.code).toBe(code);
    expect(error.message).toBe(code);
  });

  test("a retry-after makes any failure a rate limit and is read in ms", () => {
    const error = slackErrorOf({ code: "internal_error", fallback: "x", retryAfter: "5" });
    expect(error.kind).toBe("rate_limited");
    expect(error.retryAfterMs).toBe(5000);
  });

  test("an unparseable retry-after is ignored", () => {
    expect(slackErrorOf({ fallback: "x", retryAfter: "soon" }).retryAfterMs).toBeUndefined();
  });

  test("http status classifies when there is no code", () => {
    expect(slackErrorOf({ fallback: "x", status: 429 }).kind).toBe("rate_limited");
    expect(slackErrorOf({ fallback: "x", status: 401 }).kind).toBe("auth");
    expect(slackErrorOf({ fallback: "x", status: 502 }).kind).toBe("transient");
  });

  test("the fallback becomes the message without a code", () => {
    const error = slackErrorOf({ fallback: "client.counts failed" });
    expect(error.message).toBe("client.counts failed");
    expect(error.code).toBeUndefined();
  });

  test("keeps the cause", () => {
    const cause = new Error("boom");
    expect(slackErrorOf({ fallback: "x" }, { cause }).cause).toBe(cause);
  });
});

describe("helpers", () => {
  test("replyError reads the failure payload", () => {
    const error = replyError({ error: "ratelimited", ok: false, retry_after: "2" }, "x");
    expect(error).toMatchObject({ code: "ratelimited", kind: "rate_limited", retryAfterMs: 2000 });
  });

  test("networkError carries the cause", () => {
    const cause = new TypeError("fetch failed");
    const error = networkError(cause);
    expect(error.kind).toBe("network");
    expect(error.cause).toBe(cause);
  });

  test("isSlackError and isAuthError", () => {
    expect(isSlackError(networkError(undefined))).toBe(true);
    expect(isSlackError(new Error("x"))).toBe(false);
    expect(isAuthError("not_authed")).toBe(true);
    expect(isAuthError("channel_not_found")).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
  });
});

describe("retryDecision", () => {
  const of = (kind: SlackError["kind"]) => new SlackError({ kind, message: kind });

  test("retries transient, network and rate limited failures until the third attempt", () => {
    for (const kind of ["transient", "network", "rate_limited"] as const) {
      expect(retryDecision(of(kind), 0)).toBe("retry");
      expect(retryDecision(of(kind), 2)).toBe("retry");
      expect(retryDecision(of(kind), 3)).toBe("stop");
    }
  });

  test("never retries auth or deterministic failures", () => {
    expect(retryDecision(of("auth"), 0)).toBe("stop");
    expect(retryDecision(of("deterministic"), 0)).toBe("stop");
  });

  test("retries an unclassified error", () => {
    expect(retryDecision(new Error("fetch failed"), 1)).toBe("retry");
  });
});
