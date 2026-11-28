import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { toLocalInputValue } from "@slock/core";
import {
  dateDueFromInput,
  nextHourInputValue,
  REMINDER_OPTIONS,
} from "../../../../packages/plugins/src/reminders/client/times";
import { forAll, int } from "../../../support/core";

const option = (label: string) => {
  const found = REMINDER_OPTIONS.find((item) => item.label === label);
  if (!found) throw new Error(label);
  return found.dateDue;
};

const localDate = (seconds: number) => new Date(seconds * 1000);
const randomNow = (random: () => number) =>
  new Date(2026, int(random, 0, 11), int(random, 1, 28), int(random, 0, 23), int(random, 0, 59));

describe("relative options", () => {
  test("offsets are exact", () => {
    const now = new Date(2026, 5, 10, 12, 0, 30);
    const base = Math.floor(now.getTime() / 1000);
    expect(option("in 20 minutes")(now)).toBe(base + 1200);
    expect(option("in 1 hour")(now)).toBe(base + 3600);
    expect(option("in 3 hours")(now)).toBe(base + 10800);
  });

  test("tomorrow is 9:00 local on the next calendar day", () => {
    forAll(randomNow, (now) => {
      const due = localDate(option("tomorrow")(now));
      const expected = new Date(now);
      expected.setDate(expected.getDate() + 1);
      expect([due.getFullYear(), due.getMonth(), due.getDate()]).toEqual([
        expected.getFullYear(),
        expected.getMonth(),
        expected.getDate(),
      ]);
      expect([due.getHours(), due.getMinutes(), due.getSeconds()]).toEqual([9, 0, 0]);
    });
  });

  test("next week is a Monday 9:00 within the next 7 days", () => {
    forAll(randomNow, (now) => {
      const dueSeconds = option("next week")(now);
      const due = localDate(dueSeconds);
      expect(due.getDay()).toBe(1);
      expect([due.getHours(), due.getMinutes()]).toEqual([9, 0]);
      const nowSeconds = Math.floor(now.getTime() / 1000);
      expect(dueSeconds).toBeGreaterThan(nowSeconds);
      expect(dueSeconds - nowSeconds).toBeLessThanOrEqual(7 * 86400 + 10 * 3600);
    });
  });

  test("on a Monday morning next week is seven days out", () => {
    const monday = new Date(2026, 5, 8, 7, 0);
    const due = localDate(option("next week")(monday));
    expect(due.getDate()).toBe(15);
  });

  test("on a Sunday next week is tomorrow", () => {
    const sunday = new Date(2026, 5, 14, 23, 59);
    expect(localDate(option("next week")(sunday)).getDate()).toBe(15);
  });

  test("every option is in the future", () => {
    forAll(randomNow, (now) => {
      const nowSeconds = Math.floor(now.getTime() / 1000);
      for (const item of REMINDER_OPTIONS) expect(item.dateDue(now)).toBeGreaterThan(nowSeconds);
    });
  });

  test("tomorrow rolls over a month end", () => {
    const due = localDate(option("tomorrow")(new Date(2026, 0, 31, 12, 0)));
    expect([due.getMonth(), due.getDate(), due.getHours()]).toEqual([1, 1, 9]);
  });
});

describe("daylight saving", () => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Europe/Brussels";
  });
  afterAll(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  test("tomorrow stays 9:00 local across spring forward", () => {
    const due = option("tomorrow")(new Date("2026-03-28T11:00:00Z"));
    expect(new Date(due * 1000).toISOString()).toBe("2026-03-29T07:00:00.000Z");
  });

  test("tomorrow stays 9:00 local across fall back", () => {
    const due = option("tomorrow")(new Date("2026-10-24T11:00:00Z"));
    expect(new Date(due * 1000).toISOString()).toBe("2026-10-25T08:00:00.000Z");
  });

  test("hour offsets are absolute across the change", () => {
    const now = new Date("2026-03-29T00:30:00Z");
    expect(option("in 3 hours")(now) - Math.floor(now.getTime() / 1000)).toBe(10800);
  });
});

describe("custom time input", () => {
  test("formats local time with padding", () => {
    expect(toLocalInputValue(new Date(2026, 0, 5, 7, 4))).toBe("2026-01-05T07:04");
  });

  test("input value round trips to whole minutes", () => {
    forAll(
      (random) =>
        new Date(
          2026,
          int(random, 0, 8),
          int(random, 1, 28),
          int(random, 0, 23),
          int(random, 0, 59),
        ),
      (date) => {
        expect(dateDueFromInput(toLocalInputValue(date))).toBe(Math.floor(date.getTime() / 1000));
      },
    );
  });

  test("next hour rounds up to the top of the hour", () => {
    expect(nextHourInputValue(new Date(2026, 5, 10, 12, 30))).toBe("2026-06-10T13:00");
    expect(nextHourInputValue(new Date(2026, 5, 10, 23, 59))).toBe("2026-06-11T00:00");
  });

  test("garbage input is not a time", () => {
    for (const value of ["", "soon", "2026-13-45T99:99"])
      expect(dateDueFromInput(value)).toBeNull();
  });
});
