// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { menuNavigationIndex } from "../../../../ui/src/overlay/floating/menuNavigation";

describe("menuNavigationIndex", () => {
  test("enters from either direction and wraps at the ends", () => {
    expect(menuNavigationIndex("ArrowDown", null, 3)).toBe(0);
    expect(menuNavigationIndex("ArrowUp", null, 3)).toBe(2);
    expect(menuNavigationIndex("ArrowDown", 2, 3)).toBe(0);
    expect(menuNavigationIndex("ArrowUp", 0, 3)).toBe(2);
  });

  test("supports boundary keys and ignores unrelated input", () => {
    expect(menuNavigationIndex("Home", 2, 3)).toBe(0);
    expect(menuNavigationIndex("End", 0, 3)).toBe(2);
    expect(menuNavigationIndex("Enter", 1, 3)).toBeUndefined();
    expect(menuNavigationIndex("ArrowDown", null, 0)).toBeUndefined();
  });
});
