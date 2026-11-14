import { describe, expect, test } from "bun:test";
import { defined, isRecord, narrowByType } from "../../src/util/guards";

describe("isRecord", () => {
  test("accepts objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
    expect(isRecord(new Map())).toBe(true);
  });

  test("rejects everything else", () => {
    for (const value of [null, undefined, 0, "", "x", true, [], [1], () => ({}), Symbol("x")])
      expect(isRecord(value)).toBe(false);
  });
});

describe("narrowByType", () => {
  type Block = { type: "section"; text: string } | { type: "divider" };

  test("returns the value when the type matches", () => {
    const block: Block = { text: "hi", type: "section" };
    expect(narrowByType<Block, Extract<Block, { type: "section" }>>(block, "section")).toBe(block);
  });

  test("returns undefined on another type or no value", () => {
    const block: Block = { type: "divider" };
    expect(
      narrowByType<Block, Extract<Block, { type: "section" }>>(block, "section"),
    ).toBeUndefined();
    expect(
      narrowByType<Block, Extract<Block, { type: "section" }>>(undefined, "section"),
    ).toBeUndefined();
  });
});

describe("defined", () => {
  test("passes through falsy values that are not null or undefined", () => {
    expect(defined(0)).toBe(0);
    expect(defined("")).toBe("");
    expect(defined(false)).toBe(false);
  });

  test("throws for null and undefined", () => {
    expect(() => defined(null)).toThrow("expected a defined value");
    expect(() => defined(undefined)).toThrow("expected a defined value");
  });
});
