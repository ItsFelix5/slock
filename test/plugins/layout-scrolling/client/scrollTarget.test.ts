import { expect, test } from "bun:test";
import { scrollLeftToReveal } from "../../../../packages/plugins/src/layout-scrolling/client/views/scrollTarget";

const viewport = { scrollLeft: 100, width: 400 };

test("a cell fully inside the viewport needs no scroll", () => {
  expect(scrollLeftToReveal({ left: 100, width: 400 }, viewport)).toBeUndefined();
  expect(scrollLeftToReveal({ left: 150, width: 100 }, viewport)).toBeUndefined();
});

test("a cell clipped on the left scrolls to its left edge", () => {
  expect(scrollLeftToReveal({ left: 50, width: 100 }, viewport)).toBe(50);
});

test("a cell clipped on the right scrolls to its right edge", () => {
  expect(scrollLeftToReveal({ left: 450, width: 100 }, viewport)).toBe(150);
});
