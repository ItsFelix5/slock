import { describe, expect, test } from "bun:test";
import { forAll, int, pick, seededRandom, text } from "../src/testing";

describe("seededRandom", () => {
  test("repeats for the same seed", () => {
    const first = seededRandom(7);
    const second = seededRandom(7);
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  test("stays inside [0, 1)", () => {
    const random = seededRandom(1);
    for (let i = 0; i < 1000; i++) expect(random()).toBeLessThan(1);
  });
});

describe("generators", () => {
  test("int is inclusive on both ends", () => {
    const random = seededRandom(3);
    const seen = new Set(Array.from({ length: 200 }, () => int(random, 1, 3)));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  test("pick refuses an empty list", () => {
    expect(() => pick(seededRandom(1), [])).toThrow();
  });

  test("text only uses the alphabet and respects maxLength", () => {
    forAll(
      (random) => text(random, "ab😀", 5),
      (value) => expect([...value].length <= 5 && /^[ab😀]*$/u.test(value)).toBe(true),
    );
  });
});

describe("forAll", () => {
  test("reports the failing seed and value", () => {
    expect(() =>
      forAll(
        (random) => int(random, 0, 9),
        (value) => expect(value).toBeLessThan(0),
        5,
      ),
    ).toThrow(/seed 1:/);
  });
});
