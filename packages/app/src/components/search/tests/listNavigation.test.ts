// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { listNavigationIndex } from "../../../../../ui/src/form/listNavigation";

describe("listNavigationIndex", () => {
  test("enters a list from either direction", () => {
    expect(listNavigationIndex("ArrowDown", null, 4)).toBe(0);
    expect(listNavigationIndex("ArrowUp", null, 4)).toBe(3);
  });

  test("clamps arrow navigation at list boundaries", () => {
    expect(listNavigationIndex("ArrowUp", 0, 4)).toBe(0);
    expect(listNavigationIndex("ArrowDown", 3, 4)).toBe(3);
  });

  test("supports Home and End and ignores unrelated keys", () => {
    expect(listNavigationIndex("Home", 2, 4)).toBe(0);
    expect(listNavigationIndex("End", 1, 4)).toBe(3);
    expect(listNavigationIndex("Enter", 1, 4)).toBeUndefined();
    expect(listNavigationIndex("ArrowDown", null, 0)).toBeUndefined();
  });
});
