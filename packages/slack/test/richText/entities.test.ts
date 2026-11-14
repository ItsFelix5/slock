import { describe, expect, test } from "bun:test";
import { forAll, text } from "@slock/core/testing";
import { decodeTextEntities, encodeTextEntities } from "../../src/richText/entities";

describe("entities", () => {
  test.each([
    ["&amp;", "&"],
    ["&lt;b&gt;", "<b>"],
    ["&quot;&#39;&#x27;", `"''`],
    ["&AMP;", "&"],
    ["&amp;lt;", "&lt;"],
    ["&unknown;", "&unknown;"],
    ["a & b", "a & b"],
    ["", ""],
  ])("decode %s", (input, expected) => {
    expect(decodeTextEntities(input)).toBe(expected);
  });

  test("encode escapes the three Slack characters in the right order", () => {
    expect(encodeTextEntities('<a href="x">&</a>')).toBe('&lt;a href="x"&gt;&amp;&lt;/a&gt;');
    expect(encodeTextEntities("&lt;")).toBe("&amp;lt;");
  });

  test("decode undoes encode for any text", () => {
    forAll(
      (random) => text(random, "ab&<>;#x39lgtamp \"'😀‮", 30),
      (value) => expect(decodeTextEntities(encodeTextEntities(value))).toBe(value),
      500,
    );
  });

  test("encoded text never contains raw angle brackets", () => {
    forAll(
      (random) => text(random, "a&<>;", 30),
      (value) => expect(encodeTextEntities(value)).not.toMatch(/[<>]/),
    );
  });
});
