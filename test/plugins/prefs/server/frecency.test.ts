import { expect, test } from "bun:test";
import { trimFrecency } from "@slock/plugins/prefs/server/frecency";

const entry = (id: string, count: number, visits: number[]) => ({ count, id, visits });

test("keeps channel entries only, with the last visit", () => {
  const raw = JSON.stringify({
    a: entry("C1", 3, [10, 40, 20]),
    b: entry("U1", 9, [5]),
    c: entry("D2", 1, []),
  });
  expect(JSON.parse(trimFrecency({ frecency_ent_jumper: raw }))).toEqual({
    C1: { count: 3, id: "C1", lastVisit: 40 },
    D2: { count: 1, id: "D2", lastVisit: 0 },
  });
});

test("keeps the highest count per channel", () => {
  const raw = JSON.stringify({ a: entry("C1", 2, [1]), b: entry("C1", 5, [9]) });
  expect(JSON.parse(trimFrecency({ frecency: raw })).C1).toEqual({
    count: 5,
    id: "C1",
    lastVisit: 9,
  });
});

test("prefers ent_jumper over the older keys and survives bad json", () => {
  const newer = JSON.stringify({ a: entry("C1", 1, [1]) });
  const older = JSON.stringify({ a: entry("C2", 1, [1]) });
  expect(
    Object.keys(JSON.parse(trimFrecency({ frecency: older, frecency_ent_jumper: newer }))),
  ).toEqual(["C1"]);
  expect(trimFrecency({ frecency_ent_jumper: "{", frecency_jumper: older })).toContain("C2");
  expect(trimFrecency({})).toBe("{}");
});
