import { describe, expect, test } from "bun:test";
import { toLocalInputValue } from "../../src/util/toLocalInputValue";

const date = new Date(2026, 0, 5, 7, 8, 9);

describe("toLocalInputValue", () => {
  test("defaults to minute precision", () => {
    expect(toLocalInputValue(date)).toBe("2026-01-05T07:08");
  });

  test("formats seconds", () => {
    expect(toLocalInputValue(date, "second")).toBe("2026-01-05T07:08:09");
  });

  test("formats the date only", () => {
    expect(toLocalInputValue(date, "date")).toBe("2026-01-05");
  });

  test("uses local time, not UTC", () => {
    const lateNight = new Date(2026, 11, 31, 23, 59);
    expect(toLocalInputValue(lateNight)).toBe("2026-12-31T23:59");
  });

  test("accepts ms", () => {
    expect(toLocalInputValue(date.getTime(), "second")).toBe("2026-01-05T07:08:09");
  });
});
