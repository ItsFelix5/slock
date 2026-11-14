import { describe, expect, test } from "bun:test";
import { forAll, int, pick } from "@slock/core/testing";
import {
  gridNavigationIndex,
  type ListDirection,
  listNavigationIndex,
} from "../../src/form/listNavigation";

describe("listNavigationIndex", () => {
  test("returns nothing for an empty list", () => {
    for (const direction of ["down", "up", "start", "end"] as const) {
      expect(listNavigationIndex(direction, null, 0)).toBeUndefined();
    }
  });

  test("first press enters from the matching edge", () => {
    expect(listNavigationIndex("down", null, 5)).toBe(0);
    expect(listNavigationIndex("up", null, 5)).toBe(4);
  });

  test("clamps at the ends unless wrapping", () => {
    expect(listNavigationIndex("down", 4, 5)).toBe(4);
    expect(listNavigationIndex("up", 0, 5)).toBe(0);
    expect(listNavigationIndex("down", 4, 5, { wrap: true })).toBe(0);
    expect(listNavigationIndex("up", 0, 5, { wrap: true })).toBe(4);
  });

  test("start and end jump to the edges", () => {
    expect(listNavigationIndex("start", 3, 5)).toBe(0);
    expect(listNavigationIndex("end", 1, 5)).toBe(4);
  });

  test("always lands inside the list", () => {
    forAll(
      (random) => ({
        count: int(random, 1, 30),
        direction: pick<ListDirection>(random, ["down", "up", "start", "end"]),
        wrap: pick(random, [true, false]),
      }),
      ({ count, direction, wrap }) => {
        let current: number | null = null;
        for (let step = 0; step < 40; step++) {
          const next = listNavigationIndex(direction, current, count, { wrap });
          expect(next).toBeGreaterThanOrEqual(0);
          expect(next).toBeLessThan(count);
          current = next ?? null;
        }
      },
    );
  });
});

describe("gridNavigationIndex", () => {
  test("moves by one horizontally and by a row vertically", () => {
    expect(gridNavigationIndex("right", 2, 10, 4)).toBe(3);
    expect(gridNavigationIndex("left", 2, 10, 4)).toBe(1);
    expect(gridNavigationIndex("down", 2, 10, 4)).toBe(6);
    expect(gridNavigationIndex("up", 6, 10, 4)).toBe(2);
  });

  test("clamps instead of wrapping and never leaves the grid", () => {
    expect(gridNavigationIndex("down", 8, 10, 4)).toBe(9);
    expect(gridNavigationIndex("up", 1, 10, 4)).toBe(0);
    expect(gridNavigationIndex("right", 9, 10, 4)).toBe(9);
    expect(gridNavigationIndex("left", 0, 10, 4)).toBe(0);
  });

  test("enters from the matching edge when nothing is focused", () => {
    expect(gridNavigationIndex("down", null, 10, 4)).toBe(0);
    expect(gridNavigationIndex("right", null, 10, 4)).toBe(0);
    expect(gridNavigationIndex("up", null, 10, 4)).toBe(9);
    expect(gridNavigationIndex("left", null, 10, 4)).toBe(9);
    expect(gridNavigationIndex("end", null, 10, 4)).toBe(9);
    expect(gridNavigationIndex("start", 5, 10, 4)).toBe(0);
  });

  test("returns nothing for an empty grid", () => {
    expect(gridNavigationIndex("down", null, 0, 4)).toBeUndefined();
  });
});
