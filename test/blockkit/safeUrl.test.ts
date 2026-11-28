import { describe, expect, test } from "bun:test";
import {
  HTTP_URL_RE,
  safeEmbedUrl,
  safeMediaUrl,
  safeUrl,
} from "../../packages/blockkit/src/safeUrl";
import { forAll, pick, text } from "../support/core";

describe("safeUrl", () => {
  test.each([
    ["https://example.com/a?b=1#c", "https://example.com/a?b=1#c"],
    ["HTTP://EXAMPLE.COM", "HTTP://EXAMPLE.COM"],
    ["  https://example.com  ", "https://example.com"],
    ["mailto:felix@example.com", "mailto:felix@example.com"],
    ["tel:+32123456", "tel:+32123456"],
    ["slack://channel?team=T1&id=C1", "slack://channel?team=T1&id=C1"],
  ])("keeps %p", (input, expected) => {
    expect(safeUrl(input)).toBe(expected);
  });

  test.each([
    "javascript:alert(1)",
    " JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "file:///etc/passwd",
    "//example.com",
    "example.com",
    "",
    "   ",
  ])("rejects %p", (input) => {
    expect(safeUrl(input)).toBeUndefined();
  });

  test("rejects undefined", () => {
    expect(safeUrl(undefined)).toBeUndefined();
  });

  test("is idempotent and never throws on garbage", () => {
    forAll(
      (random) =>
        `${pick(random, ["", " ", "https://", "javascript:", "mailto:"])}${text(random, "ab :/\n\u{202e}\u{1f600}")}`,
      (input) => {
        const once = safeUrl(input);
        expect(safeUrl(once)).toBe(once);
      },
    );
  });

  test("HTTP_URL_RE only matches http and https prefixes", () => {
    expect(HTTP_URL_RE.test("https://a.b")).toBe(true);
    expect(HTTP_URL_RE.test("HTTP://a.b")).toBe(true);
    expect(HTTP_URL_RE.test("mailto:a@b")).toBe(false);
    expect(HTTP_URL_RE.test(" https://a.b")).toBe(false);
  });
});

describe("safeMediaUrl", () => {
  test.each([
    ["https://files.slack.com/a.png", "/api/assets?url=https%3A%2F%2Ffiles.slack.com%2Fa.png"],
    ["  http://a.b/c.gif ", "http://a.b/c.gif"],
    [
      "/api/assets?url=https%3A%2F%2Ffiles.slack.com%2Fa.png",
      "/api/assets?url=https%3A%2F%2Ffiles.slack.com%2Fa.png",
    ],
  ])("keeps %p", (input, expected) => {
    expect(safeMediaUrl(input)).toBe(expected);
  });

  test.each([
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "data:image/svg+xml,<svg onload=alert(1)>",
    "blob:https://a.b/1",
    "mailto:a@b",
    "tel:1",
    "slack://open",
    "//evil.com/x.png",
    "/api/emoji/x",
    "",
  ])("rejects %p", (input) => {
    expect(safeMediaUrl(input)).toBeUndefined();
    expect(safeMediaUrl(undefined)).toBeUndefined();
  });

  test("accepts nothing safeUrl-only schemes allow", () => {
    forAll(
      (random) =>
        `${pick(random, ["mailto:", "tel:", "slack://", "javascript:"])}${text(random, "ab/")}`,
      (input) => expect(safeMediaUrl(input)).toBeUndefined(),
    );
  });
});

describe("safeEmbedUrl", () => {
  const appOrigin = "https://app.example.com";

  test("allows other origins", () => {
    expect(safeEmbedUrl("https://www.youtube.com/embed/x", appOrigin)).toBe(
      "https://www.youtube.com/embed/x",
    );
  });

  test.each([
    "https://app.example.com/anything",
    "HTTPS://APP.EXAMPLE.COM/x",
    "https://app.example.com:443/x",
    "https://app.example.com@evil.com/x:y",
  ])("handles origin tricks %p", (input) => {
    const result = safeEmbedUrl(input, appOrigin);
    expect(result === undefined).toBe(new URL(input).origin === appOrigin);
  });

  test("rejects non-http and unparsable urls", () => {
    expect(safeEmbedUrl("javascript:alert(1)", appOrigin)).toBeUndefined();
    expect(safeEmbedUrl("https://", appOrigin)).toBeUndefined();
    expect(safeEmbedUrl(undefined, appOrigin)).toBeUndefined();
  });
});
