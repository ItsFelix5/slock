import { expect, test } from "bun:test";
import { scrollLeftToReveal } from "../../../src/layout-scrolling/client/views/scrollTarget";

const viewport = { scrollLeft: 100, width: 400 };

test("a cell fully inside the viewport needs no scroll", () => {
  expect(scrollLeftToReveal({ left: 100, width: 400 }, viewport)).toBeUndefined();
  expect(scrollLeftToReveal({ left: 150, width: 100 }, viewport)).toBeUndefined();
});

test("a cell clipped on either side is centred", () => {
  expect(scrollLeftToReveal({ left: 50, width: 100 }, viewport)).toBe(-100);
  expect(scrollLeftToReveal({ left: 450, width: 100 }, viewport)).toBe(300);
});
