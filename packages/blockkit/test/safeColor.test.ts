import { describe, expect, test } from "bun:test";
import { forAll, pick, text } from "@slock/core/testing";
import { safeBase64, safeColor } from "../src/safeColor";

describe("safeColor", () => {
  test.each([
    ["#ff0000", "#ff0000"],
    ["ff0000", "#ff0000"],
    ["#F0a", "#F0a"],
    ["#ff000080", "#ff000080"],
    [" #2eb886 ", "#2eb886"],
  ])("keeps %p", (input, expected) => {
    expect(safeColor(input)).toBe(expected);
  });

  test.each([
    "red",
    "good",
    "danger",
    "#ff000",
    "#ggg",
    "#12345",
    "url(https://evil.com/x.png)",
    "#fff;background:url(https://evil.com/x.png)",
    "#fff) , url(https://evil.com/x.png",
    "var(--x)",
    "rgb(0,0,0)",
    "",
    "#",
  ])("rejects %p", (input) => {
    expect(safeColor(input)).toBeUndefined();
  });

  test("rejects undefined", () => {
    expect(safeColor(undefined)).toBeUndefined();
  });

  test("output is always a plain hex color", () => {
    forAll(
      (random) =>
        `${pick(random, ["", "#", " #"])}${text(random, "0123456789abcdefgxyz();:, url", 12)}`,
      (input) => {
        const color = safeColor(input);
        if (color !== undefined) expect(color).toMatch(/^#[0-9a-f]+$/i);
      },
    );
  });
});

describe("safeBase64", () => {
  test("keeps base64 payloads", () => {
    expect(safeBase64("/9j/4AAQSkZJRgABAQ==")).toBe("/9j/4AAQSkZJRgABAQ==");
  });

  test.each([
    "abc), url(https://evil.com/x.png",
    'abc"onerror="x',
    "abc def",
    "abc\n",
    "",
  ])("rejects %p", (input) => {
    expect(safeBase64(input)).toBeUndefined();
  });

  test("rejects undefined", () => {
    expect(safeBase64(undefined)).toBeUndefined();
  });
});
