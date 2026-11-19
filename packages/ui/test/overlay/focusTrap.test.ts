import { describe, expect, test } from "bun:test";
import { forAll, int } from "@slock/core/testing";
import {
  isTopFocusLayer,
  popFocusLayer,
  pushFocusLayer,
  tabWrapTarget,
} from "../../src/overlay/dialog/focusTrap";

describe("tabWrapTarget", () => {
  test.each([
    [0, 3, false, undefined],
    [1, 3, false, undefined],
    [2, 3, false, "first"],
    [0, 3, true, "last"],
    [1, 3, true, undefined],
    [0, 1, false, "first"],
    [0, 1, true, "last"],
    ["outside", 3, false, "first"],
    ["outside", 3, true, "last"],
    [0, 0, false, undefined],
    ["outside", 0, true, undefined],
  ] as const)("position %p of %p backwards %p wraps to %p", (position, count, backwards, expected) => {
    expect(tabWrapTarget(position, count, backwards)).toBe(expected);
  });

  test("only the two edges ever wrap", () => {
    forAll(
      (random) => {
        const count = int(random, 1, 20);
        return { count, index: int(random, 0, count - 1), backwards: random() < 0.5 };
      },
      ({ count, index, backwards }) => {
        const wrapped = tabWrapTarget(index, count, backwards);
        const atEdge = backwards ? index === 0 : index === count - 1;
        expect(wrapped !== undefined).toBe(atEdge);
      },
    );
  });
});

describe("focus layers", () => {
  test("the newest layer is on top", () => {
    const first = pushFocusLayer();
    const second = pushFocusLayer();
    expect(isTopFocusLayer(second)).toBe(true);
    expect(isTopFocusLayer(first)).toBe(false);
    popFocusLayer(second);
    popFocusLayer(first);
  });

  test("popping the top layer reveals the one below", () => {
    const first = pushFocusLayer();
    const second = pushFocusLayer();
    const result = popFocusLayer(second);
    expect(result.wasTop).toBe(true);
    expect(result.revealed).toBe(first);
    expect(isTopFocusLayer(first)).toBe(true);
    popFocusLayer(first);
  });

  test("popping a covered layer leaves the top alone", () => {
    const first = pushFocusLayer();
    const second = pushFocusLayer();
    const result = popFocusLayer(first);
    expect(result.wasTop).toBe(false);
    expect(result.revealed).toBe(second);
    popFocusLayer(second);
  });

  test("popping twice is harmless and an empty stack has no top", () => {
    const layer = pushFocusLayer();
    popFocusLayer(layer);
    const again = popFocusLayer(layer);
    expect(again.wasTop).toBe(false);
    expect(again.revealed).toBeUndefined();
    expect(isTopFocusLayer(undefined)).toBe(true);
  });
});
