import { describe, expect, test } from "bun:test";
import { errorMessage } from "../../../packages/core/src/util/errorMessage";

describe("errorMessage", () => {
  test("uses the message of an Error", () => {
    expect(errorMessage(new TypeError("bad input"))).toBe("bad input");
  });

  test("an Error without a message gives the fallback", () => {
    const silent = Object.assign(new Error("x"), { message: "" });
    expect(errorMessage(silent)).toBe("Unknown error");
    expect(errorMessage(silent, "oops")).toBe("oops");
  });

  test("keeps a non-empty string as is", () => {
    expect(errorMessage("ratelimited")).toBe("ratelimited");
  });

  test("an empty string gives the fallback", () => {
    expect(errorMessage("", "oops")).toBe("oops");
  });

  test("serializes plain objects the way Slack sends them", () => {
    expect(errorMessage({ error: "channel_not_found", ok: false })).toBe(
      '{"error":"channel_not_found","ok":false}',
    );
  });

  test("falls back for null and undefined", () => {
    expect(errorMessage(null, "oops")).toBe("oops");
    expect(errorMessage(undefined)).toBe("Unknown error");
  });

  test("falls back for values JSON cannot serialize", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    for (const value of [circular, 10n, Symbol("x"), () => 1])
      expect(errorMessage(value, "oops")).toBe("oops");
  });

  test("stringifies numbers and booleans", () => {
    expect(errorMessage(0)).toBe("0");
    expect(errorMessage(false)).toBe("false");
  });
});
