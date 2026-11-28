import { describe, expect, test } from "bun:test";
import { escapeRegExp } from "../../../packages/core/src/util/escapeRegExp";
import { forAll, text } from "../../support/core";

const SPECIAL = [".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\"].join("");

describe("escapeRegExp", () => {
  test("escapes every special character", () => {
    expect(escapeRegExp(SPECIAL)).toBe([...SPECIAL].map((char) => `\\${char}`).join(""));
  });

  test("leaves plain text alone", () => {
    expect(escapeRegExp("hello world 42")).toBe("hello world 42");
  });

  test("matches the original text literally", () => {
    forAll(
      (random) => text(random, `ab ${SPECIAL}-`, 12),
      (value) => expect(new RegExp(`^${escapeRegExp(value)}$`).test(value)).toBe(true),
    );
  });

  test("does not match other text", () => {
    expect(new RegExp(escapeRegExp("a.c")).test("abc")).toBe(false);
  });
});
