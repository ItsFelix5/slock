import { describe, expect, test } from "bun:test";
import { tabWrapTarget } from "../../../packages/ui/src/overlay/dialog/focusTrap";
import { forAll, int } from "../../support/core";

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
        return {
          count,
          index: int(random, 0, count - 1),
          backwards: random() < 0.5,
        };
      },
      ({ count, index, backwards }) => {
        const wrapped = tabWrapTarget(index, count, backwards);
        const atEdge = backwards ? index === 0 : index === count - 1;
        expect(wrapped !== undefined).toBe(atEdge);
      },
    );
  });
});
