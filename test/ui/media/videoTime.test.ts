import { describe, expect, test } from "bun:test";
import {
  clampRatio,
  formatDuration,
  ratioFromPointer,
  ratioOf,
  timeFromRatio,
} from "../../../packages/ui/src/media/video/videoTime";
import { forAll, int } from "../../support/core";

describe("formatDuration", () => {
  test.each([
    [0, "0:00"],
    [5, "0:05"],
    [59.4, "0:59"],
    [59.6, "1:00"],
    [65, "1:05"],
    [600, "10:00"],
    [3599, "59:59"],
    [3600, "1:00:00"],
    [3725, "1:02:05"],
    [36000, "10:00:00"],
    [-12, "0:00"],
    [undefined, "0:00"],
    [Number.NaN, "0:00"],
    [Number.POSITIVE_INFINITY, "0:00"],
  ])("%p formats as %p", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  test("always has two digit seconds and never negative parts", () => {
    forAll(
      (random) => int(random, -100, 400000),
      (seconds) => {
        expect(formatDuration(seconds)).toMatch(/^(\d+:)?\d+:\d{2}$/);
      },
    );
  });

  test("whole seconds survive a parse round trip", () => {
    forAll(
      (random) => int(random, 0, 400000),
      (seconds) => {
        const parts = formatDuration(seconds).split(":").map(Number);
        const parsed = parts.reduce((total, part) => total * 60 + part, 0);
        expect(parsed).toBe(seconds);
      },
    );
  });
});

describe("clampRatio", () => {
  test("clamps to the unit range and maps NaN to zero", () => {
    expect(clampRatio(-3)).toBe(0);
    expect(clampRatio(0.4)).toBe(0.4);
    expect(clampRatio(7)).toBe(1);
    expect(clampRatio(Number.NaN)).toBe(0);
  });
});

describe("ratioOf", () => {
  test("is zero without a duration", () => {
    expect(ratioOf(5, 0)).toBe(0);
    expect(ratioOf(5, -1)).toBe(0);
  });

  test("never leaves the unit range", () => {
    expect(ratioOf(15, 10)).toBe(1);
    expect(ratioOf(-5, 10)).toBe(0);
    expect(ratioOf(5, 10)).toBe(0.5);
  });
});

describe("ratioFromPointer", () => {
  const track = { left: 100, width: 200 };

  test("maps the pointer inside the track", () => {
    expect(ratioFromPointer(100, track)).toBe(0);
    expect(ratioFromPointer(200, track)).toBe(0.5);
    expect(ratioFromPointer(300, track)).toBe(1);
  });

  test("clamps a drag that leaves the track", () => {
    expect(ratioFromPointer(-50, track)).toBe(0);
    expect(ratioFromPointer(900, track)).toBe(1);
  });

  test("a collapsed track never yields NaN", () => {
    expect(ratioFromPointer(100, { left: 100, width: 0 })).toBe(0);
  });
});

describe("timeFromRatio", () => {
  test("ignores seeking without a duration", () => {
    expect(timeFromRatio(0.5, 0)).toBeUndefined();
  });

  test("lands inside the media", () => {
    forAll(
      (random) => ({ ratio: random() * 4 - 2, duration: int(random, 1, 7200) }),
      ({ ratio, duration }) => {
        const time = timeFromRatio(ratio, duration);
        expect(time).toBeGreaterThanOrEqual(0);
        expect(time).toBeLessThanOrEqual(duration);
      },
    );
  });
});
