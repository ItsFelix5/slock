import { describe, expect, test } from "bun:test";

process.env.TZ = "Europe/Brussels";

import { forAll, int, pick, text } from "@slock/core/testing";
import { parseDateQuery } from "../../../../src/dates/client/lib/parseDateQuery";

const now = new Date(2026, 9, 29, 15, 30, 0);

function local(year: number, month: number, day: number, hour = 0, minute = 0) {
  return Math.floor(new Date(year, month - 1, day, hour, minute).getTime() / 1000);
}

describe("day words", () => {
  test.each([
    ["tomorrow", local(2026, 10, 30)],
    ["tom", local(2026, 10, 30)],
    ["tmr", local(2026, 10, 30)],
    ["yesterday", local(2026, 10, 28)],
    ["today", local(2026, 10, 29)],
    ["2027-01-05", local(2027, 1, 5)],
    ["dec25", local(2026, 12, 25)],
    ["25dec", local(2026, 12, 25)],
    ["jan1", local(2027, 1, 1)],
    ["oct29", local(2026, 10, 29)],
  ])("%s", (query, ts) => {
    expect(parseDateQuery(query, now)).toEqual({ hasTime: false, ts });
  });

  test("weekday is always strictly in the future", () => {
    expect(parseDateQuery("thursday", now)?.ts).toBe(local(2026, 11, 5));
    expect(parseDateQuery("friday", now)?.ts).toBe(local(2026, 10, 30));
    expect(parseDateQuery("mon", now)?.ts).toBe(local(2026, 11, 2));
  });

  test("is case insensitive", () => {
    expect(parseDateQuery("Tomorrow_9AM", now)).toEqual(parseDateQuery("tomorrow_9am", now));
  });
});

describe("times", () => {
  test.each([
    ["tomorrow_9am", local(2026, 10, 30, 9)],
    ["tomorrow_9.30pm", local(2026, 10, 30, 21, 30)],
    ["tomorrow_930", local(2026, 10, 30, 9, 30)],
    ["tomorrow_1730", local(2026, 10, 30, 17, 30)],
    ["tomorrow_12am", local(2026, 10, 30, 0)],
    ["tomorrow_12pm", local(2026, 10, 30, 12)],
    ["tomorrow_noon", local(2026, 10, 30, 12)],
    ["tomorrow_midnight", local(2026, 10, 30, 0)],
  ])("%s", (query, ts) => {
    expect(parseDateQuery(query, now)).toEqual({ hasTime: true, ts });
  });

  test("bare time rolls to tomorrow when already past", () => {
    expect(parseDateQuery("9am", now)?.ts).toBe(local(2026, 10, 30, 9));
    expect(parseDateQuery("5pm", now)?.ts).toBe(local(2026, 10, 29, 17));
  });

  test.each([
    "tomorrow_25",
    "tomorrow_13pm",
    "tomorrow_0am",
    "tomorrow_1260",
    "tomorrow_x",
  ])("rejects %s", (query) => {
    expect(parseDateQuery(query, now)).toBeUndefined();
  });
});

describe("offsets", () => {
  test("now and relative offsets", () => {
    expect(parseDateQuery("now", now)).toEqual({ hasTime: true, ts: local(2026, 10, 29, 15, 30) });
    expect(parseDateQuery("+2h", now)).toEqual({ hasTime: true, ts: local(2026, 10, 29, 17, 30) });
    expect(parseDateQuery("-30m", now)).toEqual({ hasTime: true, ts: local(2026, 10, 29, 15, 0) });
    expect(parseDateQuery("+1w", now)).toEqual({ hasTime: false, ts: local(2026, 11, 5, 15, 30) });
    expect(parseDateQuery("+1d2h", now)).toEqual({
      hasTime: true,
      ts: local(2026, 10, 30, 17, 30),
    });
  });

  test("month and year offsets", () => {
    expect(parseDateQuery("+1mo", now)?.ts).toBe(local(2026, 11, 29, 15, 30));
    expect(parseDateQuery("-1y", now)?.ts).toBe(local(2025, 10, 29, 15, 30));
  });

  test("month offsets clamp to the last day instead of overflowing", () => {
    const jan31 = new Date(2026, 0, 31, 10, 0);
    expect(parseDateQuery("+1mo", jan31)?.ts).toBe(local(2026, 2, 28, 10));
  });

  test("leap day plus one year clamps to Feb 28", () => {
    const leapDay = new Date(2028, 1, 29, 10, 0);
    expect(parseDateQuery("+1y", leapDay)?.ts).toBe(local(2029, 2, 28, 10));
  });

  test("day offsets keep the wall clock across a DST change", () => {
    const beforeShift = new Date(2026, 2, 28, 23, 30);
    expect(parseDateQuery("+1d", beforeShift)?.ts).toBe(local(2026, 3, 29, 23, 30));
    expect(parseDateQuery("+1w", beforeShift)?.ts).toBe(local(2026, 4, 4, 23, 30));
  });

  test("absurd offsets are rejected", () => {
    expect(parseDateQuery("+99999999999999d", now)).toBeUndefined();
    expect(parseDateQuery("+99999999999y", now)).toBeUndefined();
  });
});

describe("invalid input", () => {
  test.each([
    "",
    "_",
    "tomorrow_",
    "2026-02-30",
    "2026-13-01",
    "2026-00-10",
    "feb30",
    "30feb",
    "feb0",
    "constructor",
    "toString",
    "__proto__",
    "tomorrow_9am_extra",
    "+1x",
    "+d",
    "++1d",
    "emoji😀",
  ])("%j", (query) => {
    expect(parseDateQuery(query, now)).toBeUndefined();
  });

  test("Feb 29 after it passed lands on the next leap day, never Mar 1", () => {
    const afterLeapDay = new Date(2028, 2, 2, 9, 0);
    expect(parseDateQuery("feb29", afterLeapDay)?.ts).toBe(local(2032, 2, 29));
    expect(parseDateQuery("29feb", new Date(2026, 0, 1))?.ts).toBe(local(2028, 2, 29));
  });
});

describe("properties", () => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789_+-.:😀";

  test("never throws and only returns finite timestamps", () => {
    forAll(
      (random) => text(random, alphabet, 14),
      (query) => {
        const parsed = parseDateQuery(query, now);
        if (parsed) expect(Number.isFinite(parsed.ts)).toBe(true);
      },
      300,
    );
  });

  test("iso dates round trip to the same calendar day", () => {
    forAll(
      (random) => ({
        day: int(random, 1, 28),
        month: int(random, 1, 12),
        year: int(random, 1990, 2090),
      }),
      ({ year, month, day }) => {
        const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const parsed = parseDateQuery(iso, now);
        const date = new Date((parsed?.ts ?? 0) * 1000);
        expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([
          year,
          month,
          day,
        ]);
      },
    );
  });

  test("a day word with a time lands on that wall clock time", () => {
    forAll(
      (random) => ({
        day: pick(random, ["today", "tomorrow", "yesterday", "monday", "fri"]),
        hour: int(random, 0, 23),
        minute: int(random, 0, 59),
      }),
      ({ day, hour, minute }) => {
        const parsed = parseDateQuery(`${day}_${hour}${String(minute).padStart(2, "0")}`, now);
        const date = new Date((parsed?.ts ?? 0) * 1000);
        expect([date.getHours(), date.getMinutes()]).toEqual([hour, minute]);
        expect(parsed?.hasTime).toBe(true);
      },
    );
  });

  test("signed offsets of the same size mirror each other in absolute units", () => {
    forAll(
      (random) => ({ amount: int(random, 1, 500), unit: pick(random, ["m", "h"]) }),
      ({ amount, unit }) => {
        const forward = parseDateQuery(`+${amount}${unit}`, now)?.ts ?? 0;
        const back = parseDateQuery(`-${amount}${unit}`, now)?.ts ?? 0;
        expect(forward + back).toBe(2 * Math.floor(now.getTime() / 1000));
      },
    );
  });
});
