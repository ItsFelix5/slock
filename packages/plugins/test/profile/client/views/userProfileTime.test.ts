import { describe, expect, test } from "bun:test";
import { forAll, int, pick } from "@slock/core/testing";
import { parseUserId } from "@slock/slack";
import type { User } from "@slock/types";
import { createRoot } from "solid-js";
import {
  createLocalTime,
  createTzDiff,
  createTzSuffix,
  formatStartDate,
  timeZoneDiffLabel,
} from "../../../../src/profile/client/views/userProfileTime";

const userIn = (tz: string | undefined, tzLabel?: string): User => ({
  avatarColor: "#000",
  id: parseUserId("U1"),
  name: "Ann",
  tz,
  tzLabel,
});
const at = (iso: string) => Date.parse(iso);

function read<T>(create: () => () => T): T {
  return createRoot((dispose) => {
    const value = create()();
    dispose();
    return value;
  });
}

const localTime = (tz: string | undefined, now: number) =>
  read(() =>
    createLocalTime(
      () => userIn(tz),
      () => now,
    ),
  );

const diff = (tz: string | undefined, now: number) =>
  read(() =>
    createTzDiff(
      () => userIn(tz),
      () => now,
    ),
  );

describe("createLocalTime", () => {
  test.each([
    ["Asia/Kolkata", "2026-03-10T12:00:00Z", "17:30"],
    ["America/New_York", "2026-01-10T12:00:00Z", "07:00"],
    ["America/New_York", "2026-07-10T12:00:00Z", "08:00"],
    ["Pacific/Kiritimati", "2026-01-10T12:00:00Z", "02:00"],
    ["UTC", "2026-01-10T00:00:00Z", "00:00"],
  ])("%s at %s shows %s", (tz, iso, expected) => {
    expect(localTime(tz, at(iso))).toBe(expected);
  });

  test("returns null without a zone or with a garbage zone", () => {
    expect(localTime(undefined, 0)).toBeNull();
    expect(localTime("Not/AZone", 0)).toBeNull();
  });
});

describe("createTzDiff", () => {
  test("returns null without a zone or with a garbage zone", () => {
    expect(diff(undefined, 0)).toBeNull();
    expect(diff("Not/AZone", 0)).toBeNull();
  });
});

describe("timeZoneDiffLabel", () => {
  const now = at("2026-01-10T12:00:00Z");

  test.each([
    ["Europe/Brussels", "Europe/Brussels", null],
    ["Asia/Tokyo", "Asia/Seoul", null],
    ["Asia/Kolkata", "Europe/Brussels", "+4h 30m"],
    ["Europe/Brussels", "Asia/Kolkata", "-4h 30m"],
    ["Asia/Kathmandu", "UTC", "+5h 45m"],
    ["America/St_Johns", "UTC", "-3h 30m"],
    ["America/Los_Angeles", "Europe/Brussels", "-9h"],
    ["Pacific/Kiritimati", "Pacific/Pago_Pago", "+25h"],
  ])("%s seen from %s is %p", (tz, viewer, expected) => {
    expect(timeZoneDiffLabel(tz, viewer, now)).toBe(expected);
  });

  test("follows the daylight saving switch of either side", () => {
    const winter = at("2026-01-10T12:00:00Z");
    const summer = at("2026-07-10T12:00:00Z");
    expect(timeZoneDiffLabel("America/New_York", "Europe/Brussels", winter)).toBe("-6h");
    expect(timeZoneDiffLabel("America/New_York", "Europe/Brussels", summer)).toBe("-6h");
    expect(timeZoneDiffLabel("America/New_York", "UTC", winter)).toBe("-5h");
    expect(timeZoneDiffLabel("America/New_York", "UTC", summer)).toBe("-4h");
    expect(timeZoneDiffLabel("Australia/Sydney", "UTC", winter)).toBe("+11h");
    expect(timeZoneDiffLabel("Australia/Sydney", "UTC", summer)).toBe("+10h");
  });

  test("shows one hour less between the US and EU switch dates", () => {
    const between = at("2026-03-15T12:00:00Z");
    expect(timeZoneDiffLabel("America/New_York", "Europe/Brussels", between)).toBe("-5h");
  });

  test("ignores sub second noise", () => {
    const base = at("2026-03-10T12:00:00Z");
    for (const ms of [1, 500, 999])
      expect(timeZoneDiffLabel("Asia/Kolkata", "UTC", base + ms)).toBe("+5h 30m");
  });

  test("flips sign when the two zones swap", () => {
    const zones = [
      "UTC",
      "Asia/Kolkata",
      "America/St_Johns",
      "Europe/Brussels",
      "Pacific/Auckland",
    ];
    forAll(
      (random) => ({
        a: pick(random, zones),
        b: pick(random, zones),
        ms: at("2026-01-01T00:00:00Z") + int(random, 0, 365 * 24 * 60) * 60_000,
      }),
      ({ a, b, ms }) => {
        const forward = timeZoneDiffLabel(a, b, ms);
        const backward = timeZoneDiffLabel(b, a, ms);
        if (forward === null) return expect(backward).toBeNull();
        const flipped = forward.startsWith("+") ? "-" : "+";
        expect(backward).toBe(`${flipped}${forward.slice(1)}`);
      },
      60,
    );
  });
});

describe("createTzSuffix", () => {
  const suffix = (label: string | undefined, tzDiff: string | null) =>
    read(() =>
      createTzSuffix(
        () => userIn("UTC", label),
        () => tzDiff,
      ),
    );

  test.each([
    ["CET", "+1h", " (CET, +1h)"],
    ["CET", null, " (CET)"],
    [undefined, "-3h 30m", " (-3h 30m)"],
    [undefined, null, ""],
  ])("label %p diff %p gives %p", (label, tzDiff, expected) => {
    expect(suffix(label, tzDiff)).toBe(expected);
  });
});

describe("formatStartDate", () => {
  test.each([
    [undefined],
    [""],
    ["not-a-date"],
    ["2024-00-10"],
    ["2024-02-31"],
    ["2024-13-01"],
  ])("rejects %p", (value) => {
    expect(formatStartDate(value)).toBeNull();
  });

  test("keeps the day of month for edge dates", () => {
    expect(formatStartDate("2024-02-29")).toContain("29");
    expect(formatStartDate("2024-12-31")).toContain("31");
    expect(formatStartDate("2024-01-01")).toContain("1");
  });
});
