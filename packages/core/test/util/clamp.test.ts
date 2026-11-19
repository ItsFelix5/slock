import { describe, expect, test } from "bun:test";
import { clamp } from "../../src/util/clamp";

describe("clamp", () => {
  test("keeps values inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  test("keeps both bounds", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  test("raises values below the minimum", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  test("lowers values above the maximum", () => {
    expect(clamp(42, 0, 10)).toBe(10);
  });

  test("handles fractions and negative ranges", () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(-5, -10, -2)).toBe(-5);
    expect(clamp(0, -10, -2)).toBe(-2);
  });

  test("lets the minimum win when the range is inverted", () => {
    expect(clamp(5, 10, 0)).toBe(10);
  });
});
