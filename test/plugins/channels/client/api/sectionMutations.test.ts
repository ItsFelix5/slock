import { describe, expect, test } from "bun:test";
import type { ChannelSection, UserPrefs } from "@slock/types";
import {
  isChannelPlacementApplied,
  reorderSections,
  sectionMoveTarget,
  setSectionCollapsedPreference,
  setSectionSidebarPreference,
} from "../../../../../packages/plugins/src/channels/client/api/sectionMutations";
import { forAll, int } from "../../../../support/core";

const section = (id: string): ChannelSection => ({
  channelIds: [],
  id,
  name: id,
  sidebar: "all",
  type: "standard",
});
const ids = (sections: ChannelSection[] | null) => sections?.map((s) => s.id);
const abcd = ["a", "b", "c", "d"].map(section);

const prefs = (): UserPrefs => ({
  channelFrecency: {},
  channelNotifications: {},
  channelSections: {},
  emojiUse: {},
  globalNotifications: {
    desktop: "all",
    desktopPushEnabled: true,
    keywords: [],
    mpdmDesktop: "all",
    noTextInNotifications: false,
    pushIdleWait: 2,
    pushShowPreview: true,
    threadsEverything: true,
  },
  highlightWords: [],
  mutedChannels: [],
  notifyAllChannels: [],
  sectionCollapsed: {},
  sectionSidebar: {},
  sectionSort: {},
});

describe("sectionMoveTarget", () => {
  const order = ["a", "b", "c", "d"];

  test.each([
    ["b", -1, "a"],
    ["d", -1, "c"],
    ["a", 1, "c"],
    ["c", 1, null],
    ["b", 1, "d"],
  ] as const)("moving %s by %d inserts before %p", (id, direction, expected) => {
    expect(sectionMoveTarget(order, id, direction)).toBe(expected);
  });

  test("returns undefined at the edges and for unknown ids", () => {
    expect(sectionMoveTarget(order, "a", -1)).toBeUndefined();
    expect(sectionMoveTarget(order, "d", 1)).toBeUndefined();
    expect(sectionMoveTarget(order, "zzz", 1)).toBeUndefined();
    expect(sectionMoveTarget([], "a", 1)).toBeUndefined();
    expect(sectionMoveTarget(["a"], "a", 1)).toBeUndefined();
  });

  test("applying the target through reorderSections moves exactly one step", () => {
    forAll(
      (random) => ({
        count: int(random, 2, 8),
        direction: int(random, 0, 1) === 0 ? (-1 as const) : (1 as const),
        index: int(random, 0, 7),
      }),
      ({ count, direction, index }) => {
        const sections = Array.from({ length: count }, (_, i) => section(`s${i}`));
        const sectionIds = sections.map((s) => s.id);
        const moved = sectionIds[index % count];
        if (!moved) return;
        const target = sectionMoveTarget(sectionIds, moved, direction);
        if (target === undefined) return;
        const next = ids(reorderSections(sections, moved, target));
        expect(next).toBeDefined();
        expect(next?.indexOf(moved)).toBe((index % count) + direction);
        expect([...(next ?? [])].sort()).toEqual([...sectionIds].sort());
      },
    );
  });
});

describe("reorderSections", () => {
  test("places a section before the target", () => {
    expect(ids(reorderSections(abcd, "d", "b"))).toEqual(["a", "d", "b", "c"]);
    expect(ids(reorderSections(abcd, "a", "c"))).toEqual(["b", "a", "c", "d"]);
  });

  test("null target moves to the end", () => {
    expect(ids(reorderSections(abcd, "a", null))).toEqual(["b", "c", "d", "a"]);
  });

  test("returns null when nothing changes or ids are unknown", () => {
    expect(reorderSections(abcd, "a", "a")).toBeNull();
    expect(reorderSections(abcd, "a", "b")).toBeNull();
    expect(reorderSections(abcd, "d", null)).toBeNull();
    expect(reorderSections(abcd, "zzz", "a")).toBeNull();
    expect(reorderSections(abcd, "a", "zzz")).toBeNull();
    expect(reorderSections([], "a", null)).toBeNull();
  });

  test("does not mutate its input and keeps every id once", () => {
    forAll(
      (random) => ({
        from: int(random, 0, 5),
        to: int(random, -1, 5),
      }),
      ({ from, to }) => {
        const sections = Array.from({ length: 6 }, (_, i) => section(`s${i}`));
        const before = ids(sections);
        const next = reorderSections(sections, `s${from}`, to < 0 ? null : `s${to}`);
        expect(ids(sections)).toEqual(before);
        if (next) expect([...next.map((s) => s.id)].sort()).toEqual([...(before ?? [])].sort());
      },
    );
  });
});

describe("section preferences", () => {
  test("sidebar preference writes both mirrors and clears with undefined", () => {
    const hidden = setSectionSidebarPreference(prefs(), "S1", "hid");
    expect(hidden.sectionSidebar).toEqual({ S1: "hid" });
    expect(hidden.channelSections.S1?.sidebar).toBe("hid");
    const cleared = setSectionSidebarPreference(hidden, "S1", undefined);
    expect(cleared.sectionSidebar).toEqual({});
    expect(cleared.channelSections.S1?.sidebar).toBeUndefined();
  });

  test("collapsed preference writes both mirrors and clears with false", () => {
    const collapsed = setSectionCollapsedPreference(prefs(), "S1", true);
    expect(collapsed.sectionCollapsed).toEqual({ S1: true });
    expect(collapsed.channelSections.S1?.collapsed).toBe(true);
    const open = setSectionCollapsedPreference(collapsed, "S1", false);
    expect(open.sectionCollapsed).toEqual({});
    expect(open.channelSections.S1?.collapsed).toBe(false);
  });

  test("rollback restores the previous value without touching other sections", () => {
    const start = setSectionSidebarPreference(prefs(), "S2", "active");
    const changed = setSectionSidebarPreference(start, "S1", "hid");
    const rolledBack = setSectionSidebarPreference(changed, "S1", undefined);
    expect(rolledBack.sectionSidebar).toEqual({ S2: "active" });
    expect(start.sectionSidebar).toEqual({ S2: "active" });
  });

  test("keeps unrelated entries on the same section", () => {
    const base = setSectionCollapsedPreference(prefs(), "S1", true);
    const next = setSectionSidebarPreference(base, "S1", "all");
    expect(next.channelSections.S1).toEqual({ collapsed: true, sidebar: "all" });
  });
});

describe("isChannelPlacementApplied", () => {
  test("only failed is not applied", () => {
    expect(isChannelPlacementApplied("failed")).toBe(false);
    expect(isChannelPlacementApplied("applied")).toBe(true);
    expect(isChannelPlacementApplied("applied-with-warning")).toBe(true);
  });
});
