import { describe, expect, test } from "bun:test";
import type { RawCountGroup } from "@slock/types";
import { buildUnreadMap, parseBadgeCounts } from "../../../packages/slack/src/map/counts";
import { forAll, int, pick } from "../../support/core";
import { ch } from "../../support/slack";

describe("buildUnreadMap", () => {
  test("handles undefined and empty payloads", () => {
    expect(buildUnreadMap(undefined)).toEqual({});
    expect(buildUnreadMap({})).toEqual({});
  });

  test("channel mentions are explicit and unread comes from the display count", () => {
    const map = buildUnreadMap({
      channels: [
        { id: "C1", mention_count_display: 2, unread_count_display: 5 },
        { id: "C2", unread_count_display: 0 },
        { id: "C3", unread_count: 3 },
      ],
    });
    expect(map).toEqual({
      [ch("C1")]: { mentions: 2, unread: true },
      [ch("C2")]: { mentions: 0, unread: false },
      [ch("C3")]: { mentions: 0, unread: true },
    });
  });

  test("every unread dm message is a mention", () => {
    expect(buildUnreadMap({ ims: [{ id: "D1", unread_count_display: 4 }] })).toEqual({
      [ch("D1")]: { mentions: 4, unread: true },
    });
  });

  test("an explicit zero mention count stays zero in dms", () => {
    expect(
      buildUnreadMap({ ims: [{ id: "D1", mention_count: 0, unread_count: 4 }] })[ch("D1")],
    ).toEqual({
      mentions: 0,
      unread: true,
    });
  });

  test("flags are used only when no count exists", () => {
    const map = buildUnreadMap({
      channels: [
        { id: "C1", is_unread: "true" },
        { has_unreads: 1, id: "C2" },
        { id: "C3", is_unread: "0" },
        { id: "C4", is_unread: true, unread_count: 0 },
        { id: "C5", is_unread: true, unread_count: null },
      ],
    });
    expect(
      Object.fromEntries(Object.entries(map).map(([id, entry]) => [id, entry.unread])),
    ).toEqual({
      C1: true,
      C2: true,
      C3: false,
      C4: false,
      C5: true,
    });
  });

  test("groups without an id are skipped and later duplicates win", () => {
    const map = buildUnreadMap({
      channels: [{ unread_count: 3 }, { id: "C1", unread_count: 1 }, { id: "C1", unread_count: 0 }],
    });
    expect(map).toEqual({ [ch("C1")]: { mentions: 0, unread: false } });
  });

  test("mpims count like channels", () => {
    expect(buildUnreadMap({ mpims: [{ id: "G1", unread_count: 2 }] })[ch("G1")]).toEqual({
      mentions: 0,
      unread: true,
    });
  });
});

describe("parseBadgeCounts", () => {
  test("reads nested badges first", () => {
    const map = parseBadgeCounts({
      badges: { channels: [{ id: "C1", unread_count: 1 }] },
      channels: [{ id: "C2", unread_count: 1 }],
    });
    expect(Object.keys(map)).toEqual(["C1"]);
  });

  test("falls back to the top level and survives undefined", () => {
    expect(Object.keys(parseBadgeCounts({ channels: [{ id: "C2", unread_count: 1 }] }))).toEqual([
      "C2",
    ]);
    expect(parseBadgeCounts(undefined)).toEqual({});
  });
});

describe("invariants", () => {
  test("mentions are never negative and imply unread", () => {
    forAll(
      (random) =>
        Array.from(
          { length: int(random, 0, 8) },
          (_, index): RawCountGroup => ({
            id: `C${int(random, 0, 4)}${index % 3}`,
            mention_count: pick(random, [0, 1, 5]),
            unread_count: pick(random, [0, 2, 9]),
          }),
        ),
      (groups) => {
        const map = buildUnreadMap({ channels: groups });
        for (const entry of Object.values(map)) {
          expect(entry.mentions).toBeGreaterThanOrEqual(0);
          if (entry.mentions > 0) expect(entry.unread).toBe(true);
        }
        expect(Object.keys(map).length).toBeLessThanOrEqual(groups.length);
      },
    );
  });
});
