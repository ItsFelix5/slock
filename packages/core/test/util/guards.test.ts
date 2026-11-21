import { describe, expect, test } from "bun:test";
import { defined, isRecord, sameItems } from "../../src/util/guards";

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

describe("sameItems", () => {
  test("compares by identity, order and length", () => {
    const row = { id: 1 };
    expect(sameItems([row, "b"], [row, "b"])).toBe(true);
    expect(sameItems([row], [{ id: 1 }])).toBe(false);
    expect(sameItems(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameItems(["a"], ["a", "b"])).toBe(false);
    expect(sameItems([], [])).toBe(true);
  });
});
