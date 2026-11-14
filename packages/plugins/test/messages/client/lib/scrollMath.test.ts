import { describe, expect, test } from "bun:test";
import { forAll, int } from "@slock/core/testing";
import {
  distanceFromBottom,
  firstIndexWhere,
  historyLoadOnScroll,
  historyLoadToFillViewport,
  type ScrollDirection,
  type ScrollMetrics,
  scrollDirection,
} from "../../../../src/messages/client/lib/scrollMath";

const metrics = (scrollTop: number, clientHeight = 500, scrollHeight = 10_000): ScrollMetrics => ({
  clientHeight,
  scrollHeight,
  scrollTop,
});

const both = { canLoadNewer: true, canLoadOlder: true };
const directions: (ScrollDirection | undefined)[] = [undefined, "newer", "older"];

describe("distanceFromBottom", () => {
  test.each([
    [metrics(0), 9500],
    [metrics(9500), 0],
    [metrics(9498.5), 1.5],
    [metrics(0, 800, 300), -500],
  ])("%j", (input, expected) => {
    expect(distanceFromBottom(input)).toBe(expected);
  });
});

describe("scrollDirection", () => {
  test.each<[number, ScrollDirection | undefined]>([
    [120, "newer"],
    [0.5, "newer"],
    [-0.5, "older"],
    [-300, "older"],
    [0, undefined],
    [-0, undefined],
  ])("%d", (delta, expected) => {
    expect(scrollDirection(delta)).toBe(expected);
  });

  test("a swipe up (finger moves from 400 to 100) reads newer", () => {
    expect(scrollDirection(400 - 100)).toBe("newer");
    expect(scrollDirection(100 - 400)).toBe("older");
  });
});

describe("firstIndexWhere", () => {
  test("empty, all false and all true", () => {
    expect(firstIndexWhere(0, () => true)).toBe(0);
    expect(firstIndexWhere(8, () => false)).toBe(8);
    expect(firstIndexWhere(8, () => true)).toBe(0);
  });

  test("matches a linear scan on sorted data and reads O(log n) entries", () => {
    forAll(
      (random) => {
        const values = Array.from({ length: int(random, 0, 400) }, () => int(random, 0, 1000)).sort(
          (a, b) => a - b,
        );
        return { target: int(random, -5, 1005), values };
      },
      ({ target, values }) => {
        let reads = 0;
        const found = firstIndexWhere(values.length, (i) => {
          reads++;
          return (values[i] ?? 0) >= target;
        });
        const linear = values.findIndex((v) => v >= target);
        expect(found).toBe(linear === -1 ? values.length : linear);
        expect(reads).toBeLessThanOrEqual(Math.ceil(Math.log2(values.length + 1)) + 1);
      },
    );
  });
});

describe("historyLoadOnScroll", () => {
  const scroll = (
    direction: ScrollDirection | undefined,
    scrollTop: number,
    overrides: Partial<Parameters<typeof historyLoadOnScroll>[0]> = {},
  ) =>
    historyLoadOnScroll({
      ...both,
      direction,
      metrics: metrics(scrollTop),
      olderCoolingDown: false,
      ...overrides,
    });

  test("older loads within two viewports of the top, inclusive", () => {
    expect(scroll("older", 1000)).toBe("older");
    expect(scroll("older", 1001)).toBeUndefined();
    expect(scroll("older", 0)).toBe("older");
  });

  test("newer loads within two viewports of the bottom, inclusive", () => {
    expect(scroll("newer", 8500)).toBe("newer");
    expect(scroll("newer", 8499)).toBeUndefined();
  });

  test("scrolling toward newer never loads older, even when also near the top", () => {
    const short = metrics(100, 500, 900);
    expect(scroll("newer", 100, { metrics: short, canLoadNewer: false })).toBeUndefined();
  });

  test("no direction near the top still loads older", () => {
    expect(scroll(undefined, 200)).toBe("older");
    expect(scroll(undefined, 9000)).toBeUndefined();
  });

  test("cooldown and unavailable pages block loading", () => {
    expect(scroll("older", 0, { olderCoolingDown: true })).toBeUndefined();
    expect(scroll("older", 0, { canLoadOlder: false })).toBeUndefined();
    expect(scroll("newer", 9500, { canLoadNewer: false })).toBeUndefined();
  });

  test("cooldown does not block newer", () => {
    expect(scroll("newer", 9500, { olderCoolingDown: true })).toBe("newer");
  });

  test("never asks for a page that is unavailable", () => {
    forAll(
      (random) => ({
        canLoadNewer: random() < 0.5,
        canLoadOlder: random() < 0.5,
        direction: directions[int(random, 0, 2)],
        metrics: metrics(int(random, 0, 12_000), int(random, 100, 1200), int(random, 0, 12_000)),
        olderCoolingDown: random() < 0.5,
      }),
      (input) => {
        const load = historyLoadOnScroll(input);
        if (load === "newer") expect(input.canLoadNewer && input.direction === "newer").toBe(true);
        if (load === "older")
          expect(input.canLoadOlder && !input.olderCoolingDown && input.direction !== "newer").toBe(
            true,
          );
      },
    );
  });
});

describe("historyLoadToFillViewport", () => {
  test("only an underfull viewport loads", () => {
    expect(historyLoadToFillViewport(metrics(0, 600, 600), both)).toBe("older");
    expect(historyLoadToFillViewport(metrics(0, 600, 300), both)).toBe("older");
    expect(historyLoadToFillViewport(metrics(0, 600, 601), both)).toBeUndefined();
  });

  test("a hidden pane (height 0) never loads", () => {
    expect(historyLoadToFillViewport(metrics(0, 0, 0), both)).toBeUndefined();
  });

  test("older wins over newer, newer is the fallback", () => {
    const underfull = metrics(0, 600, 100);
    expect(historyLoadToFillViewport(underfull, both)).toBe("older");
    expect(historyLoadToFillViewport(underfull, { canLoadNewer: true, canLoadOlder: false })).toBe(
      "newer",
    );
    expect(
      historyLoadToFillViewport(underfull, { canLoadNewer: false, canLoadOlder: false }),
    ).toBeUndefined();
  });
});
