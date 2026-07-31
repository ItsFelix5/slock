// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { resizeWidth } from "../../../../ui/src/layout/resizeMath";

describe("resizeWidth", () => {
  test("follows the physical pointer direction for either panel edge", () => {
    expect(resizeWidth(300, 25, 1, 200, 500)).toBe(325);
    expect(resizeWidth(300, 25, -1, 200, 500)).toBe(275);
  });

  test("clamps pointer and keyboard resizing to the panel bounds", () => {
    expect(resizeWidth(490, 25, 1, 200, 500)).toBe(500);
    expect(resizeWidth(210, 25, -1, 200, 500)).toBe(200);
  });
});
