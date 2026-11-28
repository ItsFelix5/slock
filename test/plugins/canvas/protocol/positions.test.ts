import { describe, expect, test } from "bun:test";
import { assignPositions } from "../../../../packages/plugins/src/canvas/protocol/assignPositions.ts";
import { positionBetween } from "../../../../packages/plugins/src/canvas/protocol/positions.ts";
import { forAll, int, pick, type Random, text } from "../../../support/core";

const ALPHABET = "ABYZabyz";
const LAST_CHARS = "BYZabyz";

function position(random: Random): string {
  return text(random, ALPHABET, 5) + pick(random, [...LAST_CHARS]);
}

function sortedPair(random: Random): [string, string] {
  const a = position(random);
  const b = position(random);
  return a < b ? [a, b] : [b, a];
}

describe("positionBetween", () => {
  test("lands strictly between two ordered positions", () => {
    forAll(sortedPair, ([before, after]) => {
      if (before === after) return;
      const position = positionBetween(before, after, new Set([before, after]));
      expect(position > before).toBe(true);
      expect(position < after).toBe(true);
    });
  });

  test("lands after a lone before and before a lone after", () => {
    forAll(position, (value) => {
      expect(positionBetween(value, null, new Set([value])) > value).toBe(true);
      expect(positionBetween(null, value, new Set([value])) < value).toBe(true);
    });
  });

  test("avoids positions already used", () => {
    const used = new Set(["aaa"]);
    expect(positionBetween(null, null, used)).not.toBe("aaa");
  });
});

describe("assignPositions", () => {
  test("keeps an already ordered run unchanged", () => {
    expect(assignPositions(["a", "b", "c"], { floor: null }, new Set(["a", "b", "c"]))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("results are strictly increasing and unique for any mix of kept and new", () => {
    forAll(
      (random) =>
        Array.from({ length: int(random, 0, 10) }, () =>
          int(random, 0, 2) === 0 ? null : position(random),
        ),
      (existing) => {
        const used = new Set(existing.flatMap((value) => value ?? []));
        const positions = assignPositions(existing, { floor: null }, used);
        expect(positions).toHaveLength(existing.length);
        positions.slice(1).forEach((position, index) => {
          expect(position > (positions[index] ?? "")).toBe(true);
        });
      },
    );
  });
});
