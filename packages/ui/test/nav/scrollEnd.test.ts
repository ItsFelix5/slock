import { expect, test } from "bun:test";
import { isNearScrollEnd } from "../../src/nav/scrollEnd";

const metrics = (scrollTop: number) => ({ clientHeight: 300, scrollHeight: 1000, scrollTop });

test("within the threshold of the end counts as near", () => {
  expect(isNearScrollEnd(metrics(540), 160)).toBe(true);
  expect(isNearScrollEnd(metrics(700), 160)).toBe(true);
});

test("further than the threshold from the end is not near", () => {
  expect(isNearScrollEnd(metrics(539), 160)).toBe(false);
  expect(isNearScrollEnd(metrics(0), 160)).toBe(false);
});

test("content that fits without scrolling is always at the end", () => {
  expect(isNearScrollEnd({ clientHeight: 300, scrollHeight: 200, scrollTop: 0 }, 0)).toBe(true);
});
