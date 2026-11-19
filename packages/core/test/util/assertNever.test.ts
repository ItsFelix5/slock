import { describe, expect, test } from "bun:test";
import { assertNever } from "../../src/util/assertNever";

type Shape = { kind: "circle" } | { kind: "square" };

function sides(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return 0;
    case "square":
      return 4;
    default:
      return assertNever(shape);
  }
}

describe("assertNever", () => {
  test("does not interfere with handled cases", () => {
    expect(sides({ kind: "square" })).toBe(4);
  });

  test("throws naming the unhandled value", () => {
    const unknownShape: Shape = JSON.parse('{"kind":"hexagon"}');
    expect(() => sides(unknownShape)).toThrow('unhandled case: {"kind":"hexagon"}');
  });
});
