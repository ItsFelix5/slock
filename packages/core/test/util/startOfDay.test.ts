import { describe, expect, test } from "bun:test";
import { startOfDay } from "../../src/util/startOfDay";

const afternoon = new Date(2026, 2, 14, 15, 45, 12, 500);

describe("startOfDay", () => {
  test("takes ms and returns ms at local midnight", () => {
    expect(startOfDay(afternoon.getTime())).toBe(new Date(2026, 2, 14).getTime());
  });

  test("takes a Date and returns a Date at local midnight", () => {
    const result = startOfDay(afternoon);
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(new Date(2026, 2, 14).getTime());
  });

  test("does not mutate the given Date", () => {
    const input = new Date(afternoon);
    startOfDay(input);
    expect(input.getTime()).toBe(afternoon.getTime());
  });

  test("is idempotent", () => {
    const once = startOfDay(afternoon.getTime());
    expect(startOfDay(once)).toBe(once);
  });

  test("moves by whole calendar days", () => {
    expect(startOfDay(afternoon, 1).getTime()).toBe(new Date(2026, 2, 15).getTime());
    expect(startOfDay(afternoon.getTime(), -14)).toBe(new Date(2026, 1, 28).getTime());
  });

  test("keeps local midnight across a DST change", () => {
    const beforeSpringForward = new Date(2026, 2, 28, 10);
    expect(startOfDay(beforeSpringForward, 1).getTime()).toBe(new Date(2026, 2, 29).getTime());
    expect(startOfDay(beforeSpringForward, 2).getTime()).toBe(new Date(2026, 2, 30).getTime());
  });
});
