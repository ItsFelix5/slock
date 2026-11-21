import { describe, expect, test } from "bun:test";
import { bubbleFits } from "../../src/editor/format/bubbleVisibility";

describe("bubbleFits", () => {
  test("shows for a selection inside the visible editor", () => {
    expect(bubbleFits({ bottom: 40, top: 10 }, {}, 100)).toBe(true);
  });

  test("hides inside a code block", () => {
    expect(bubbleFits({ bottom: 40, top: 10 }, { "code-block": true }, 100)).toBe(false);
  });

  test("hides when the selection is scrolled above or below the editor", () => {
    expect(bubbleFits({ bottom: 40, top: -1 }, {}, 100)).toBe(false);
    expect(bubbleFits({ bottom: 101, top: 80 }, {}, 100)).toBe(false);
  });

  test("the edges count as inside", () => {
    expect(bubbleFits({ bottom: 100, top: 0 }, {}, 100)).toBe(true);
  });
});
