import { describe, expect, test } from "bun:test";
import { forAll, int } from "../../src/testing";
import { formatDay, formatDayFromMs, formatTime, formatTimeFromMs } from "../../src/util/time";

function localMs(year: number, month: number, day: number, hour = 12, minute = 0) {
  return new Date(year, month, day, hour, minute).getTime();
}

const noon = (year: number, month: number, day: number) => localMs(year, month, day, 12);

describe("formatTimeFromMs", () => {
  test("uses a 24 hour clock with two digits", () => {
    expect(formatTimeFromMs(localMs(2024, 4, 3, 7, 5))).toBe("07:05");
    expect(formatTimeFromMs(localMs(2024, 4, 3, 13, 45))).toBe("13:45");
    expect(formatTimeFromMs(localMs(2024, 4, 3, 23, 59))).toBe("23:59");
  });

  test("midnight is 00:00, never 24:00", () => {
    expect(formatTimeFromMs(localMs(2024, 4, 3, 0, 0))).toBe("00:00");
  });

  test("always renders hh:mm for any instant", () => {
    forAll(
      (random) => int(random, 0, 4_102_444_800) * 1000,
      (ms) => expect(formatTimeFromMs(ms)).toMatch(/^\d{2}:\d{2}$/),
    );
  });
});

describe("formatTime", () => {
  test("reads a Slack timestamp as seconds", () => {
    const ms = localMs(2024, 4, 3, 9, 30);
    expect(formatTime(`${ms / 1000}.000200`)).toBe("09:30");
  });

  test("agrees with formatTimeFromMs", () => {
    forAll(
      (random) => int(random, 0, 4_102_444_800),
      (seconds) => {
        expect(formatTime(`${seconds}.000100`)).toBe(formatTimeFromMs(seconds * 1000));
      },
    );
  });
});

describe("formatDayFromMs", () => {
  test("names today from its first to its last minute", () => {
    const now = noon(2024, 2, 15);
    expect(formatDayFromMs(localMs(2024, 2, 15, 0, 0), now)).toBe("Today");
    expect(formatDayFromMs(localMs(2024, 2, 15, 23, 59), now)).toBe("Today");
  });

  test("names yesterday", () => {
    const now = noon(2024, 2, 15);
    expect(formatDayFromMs(localMs(2024, 2, 14, 0, 0), now)).toBe("Yesterday");
    expect(formatDayFromMs(localMs(2024, 2, 14, 23, 59), now)).toBe("Yesterday");
  });

  test("yesterday crosses month and year boundaries", () => {
    let now = noon(2024, 2, 1);
    expect(formatDayFromMs(localMs(2024, 1, 29), now)).toBe("Yesterday");
    now = noon(2025, 0, 1);
    expect(formatDayFromMs(localMs(2024, 11, 31), now)).toBe("Yesterday");
  });

  test("older days spell out the weekday and skip the current year", () => {
    const now = noon(2024, 2, 15);
    const label = formatDayFromMs(localMs(2024, 2, 13), now);
    expect(label).toContain("Wednesday");
    expect(label).not.toContain("2024");
  });

  test("days from another year include it", () => {
    const now = noon(2025, 0, 1);
    expect(formatDayFromMs(localMs(2024, 11, 30), now)).toContain("2024");
  });

  test("future days are not today or yesterday", () => {
    const now = noon(2024, 2, 15);
    expect(formatDayFromMs(localMs(2024, 2, 16), now)).not.toMatch(/^(Today|Yesterday)$/);
  });

  test("daylight saving shifts do not move the day names", () => {
    const originalZone = process.env.TZ;
    const shifts = [
      ["America/New_York", 2, 10],
      ["America/New_York", 10, 3],
      ["Europe/Berlin", 2, 31],
      ["Europe/Berlin", 9, 27],
      ["Pacific/Auckland", 3, 7],
      ["Pacific/Auckland", 8, 29],
      ["Australia/Lord_Howe", 9, 6],
    ] as const;
    try {
      for (const [zone, month, day] of shifts) {
        process.env.TZ = zone;
        for (const [hour, minute] of [
          [0, 30],
          [12, 0],
          [23, 30],
        ]) {
          const now = localMs(2024, month, day, hour, minute);
          expect(formatDayFromMs(localMs(2024, month, day, 0, 30), now)).toBe("Today");
          expect(formatDayFromMs(localMs(2024, month, day, 23, 30), now)).toBe("Today");
          expect(formatDayFromMs(localMs(2024, month, day - 1, 0, 30), now)).toBe("Yesterday");
          expect(formatDayFromMs(localMs(2024, month, day - 1, 23, 30), now)).toBe("Yesterday");
          expect(formatDayFromMs(localMs(2024, month, day - 2, 23, 30), now)).not.toMatch(
            /^(Today|Yesterday)$/,
          );
        }
      }
    } finally {
      if (originalZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalZone;
    }
  });
});

describe("formatDay", () => {
  test("reads a Slack timestamp as seconds", () => {
    const now = noon(2024, 2, 15);
    expect(formatDay(`${localMs(2024, 2, 15) / 1000}.000200`, now)).toBe("Today");
    expect(formatDay(`${localMs(2024, 2, 14) / 1000}.000200`, now)).toBe("Yesterday");
  });
});
