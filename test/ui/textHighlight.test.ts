import { afterEach, describe, expect, test } from "bun:test";
import { findTextRanges, indexElementText } from "../../packages/ui/src/textHighlight";

afterEach(() => document.body.replaceChildren());

function indexOf(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return indexElementText(root);
}

const found = (html: string, needle: string) =>
  findTextRanges(indexOf(html), needle).map((range) => range.toString());

describe("findTextRanges", () => {
  test("matches case-insensitively and returns the original casing", () => {
    expect(found("Hello HELLO hello", "hello")).toEqual(["Hello", "HELLO", "hello"]);
  });

  test("spans element boundaries", () => {
    expect(found("<b>he</b>llo <i>wor</i>ld", "hello wor")).toEqual(["hello wor"]);
  });

  test("does not overlap matches", () => {
    expect(found("aaaa", "aa")).toEqual(["aa", "aa"]);
  });

  test("ignores blank needles and trims padding", () => {
    expect(found("abc", "   ")).toEqual([]);
    expect(found("abc", "")).toEqual([]);
    expect(found("abc def", "  def ")).toEqual(["def"]);
  });

  test("returns nothing when the text is absent", () => {
    expect(found("abc", "xyz")).toEqual([]);
  });
});
