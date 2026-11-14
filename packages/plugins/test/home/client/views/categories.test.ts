import { describe, expect, test } from "bun:test";
import { build, channel, ids, section } from "../../../../src/home/client/views/categoriesFixtures";

describe("buildCategories without sections", () => {
  test("lists channels first as hidden-read, then DMs and apps", () => {
    const result = build({ channels: [channel("C1")] });
    expect(result.map((c) => c.id)).toEqual(["channels", "__dms", "__apps"]);
    expect(result.every((c) => !c.reorderable)).toBe(true);
  });

  test("channels section is hidden-read: only unread or open channels show", () => {
    const result = build({
      channels: [channel("C1"), channel("C2"), channel("C3")],
      open: ["C3"],
      unread: ["C2"],
    });
    expect(ids(result[0]?.channels ?? [])).toEqual(["C2", "C3"]);
  });

  test("muted unread channels stay hidden unless open", () => {
    const result = build({
      channels: [channel("C1"), channel("C2")],
      muted: ["C1", "C2"],
      open: ["C2"],
      unread: ["C1", "C2"],
    });
    expect(ids(result[0]?.channels ?? [])).toEqual(["C2"]);
  });

  test("left channels never appear", () => {
    const result = build({ channels: [channel("C1")], left: ["C1"], open: ["C1"] });
    expect(result.find((c) => c.id === "channels")).toBeUndefined();
  });

  test("starred channels and DMs form a Starred category that shows all", () => {
    const result = build({
      channels: [channel("C1"), channel("C2")],
      dms: ["D1"],
      starred: ["C1", "D1"],
    });
    const [starred] = result;
    expect(starred?.id).toBe("__starred");
    expect(starred?.name).toBe("Starred");
    expect(ids(starred?.channels ?? [])).toEqual(["C1"]);
    expect(starred?.dmIds).toEqual(["D1"]);
    expect(result.find((c) => c.id === "channels")?.channels).toEqual([]);
  });

  test("DM categories need DMs of that kind", () => {
    const result = build({ hasDms: false });
    expect(result).toEqual([]);
  });

  test("empty workspace is empty", () => {
    expect(build({ hasDms: false, sections: [] })).toEqual([]);
  });
});

describe("buildCategories unreads only", () => {
  test("drops categories with nothing unread or open", () => {
    const result = build({
      channels: [channel("C1"), channel("C2")],
      hasDms: false,
      sections: [section("S1", "standard", ["C1", "C2"])],
      unread: ["C2"],
      unreadsOnly: true,
    });
    expect(result.map((c) => c.id)).toEqual(["S1"]);
    expect(ids(result[0]?.channels ?? [])).toEqual(["C2"]);
  });

  test("an empty custom section disappears", () => {
    const result = build({
      channels: [channel("C1")],
      hasDms: false,
      sections: [section("S1", "standard", ["C1"])],
      unreadsOnly: true,
    });
    expect(result).toEqual([]);
  });

  test("an open channel stays visible", () => {
    const result = build({
      channels: [channel("C1")],
      hasDms: false,
      open: ["C1"],
      sections: [section("S1", "standard", ["C1"])],
      unreadsOnly: true,
    });
    expect(ids(result[0]?.channels ?? [])).toEqual(["C1"]);
  });
});

describe("buildCategories with sections", () => {
  const channels = [channel("C1"), channel("C2"), channel("C3"), channel("C4")];

  test("keeps the order Slack sent and marks standard sections custom", () => {
    const result = build({
      channels,
      sections: [section("S2", "standard", ["C3"]), section("S1", "standard", ["C1"])],
    });
    expect(result.slice(0, 2).map((c) => [c.id, c.custom, c.reorderable])).toEqual([
      ["S2", true, true],
      ["S1", true, true],
    ]);
  });

  test("channels left out of every section land in the appended Channels category", () => {
    const result = build({
      channels,
      sections: [section("S1", "standard", ["C1"])],
      unread: ["C2"],
    });
    const rest = result.find((c) => c.id === "channels");
    expect(ids(rest?.channels ?? [])).toEqual(["C2"]);
    expect(rest?.reorderable).toBe(false);
  });

  test("a channel in two sections shows only in the first", () => {
    const result = build({
      channels,
      sections: [section("S1", "standard", ["C1", "C2"]), section("S2", "standard", ["C2", "C3"])],
    });
    expect(ids(result[0]?.channels ?? [])).toEqual(["C1", "C2"]);
    expect(ids(result[1]?.channels ?? [])).toEqual(["C3"]);
  });

  test("starred channels leave their custom section", () => {
    const result = build({
      channels,
      sections: [section("S1", "standard", ["C1", "C2"])],
      starred: ["C1"],
    });
    expect(ids(result.find((c) => c.id === "__starred")?.channels ?? [])).toEqual(["C1"]);
    expect(ids(result.find((c) => c.id === "S1")?.channels ?? [])).toEqual(["C2"]);
  });

  test("a starred DM is not repeated in its custom section", () => {
    const result = build({
      dms: ["D1", "D2"],
      sections: [section("S1", "standard", ["D1", "D2"])],
      starred: ["D1"],
    });
    expect(result.find((c) => c.id === "__starred")?.dmIds).toEqual(["D1"]);
    expect(result.find((c) => c.id === "S1")?.dmIds).toEqual(["D2"]);
  });

  test("recent sort orders by last activity and keeps missing activity last", () => {
    const result = build({
      channels: [
        channel("C1", { lastActivity: 5 }),
        channel("C2"),
        channel("C3", { lastActivity: 9 }),
      ],
      sections: [section("S1", "standard", ["C1", "C2", "C3"], { sort: "recent" })],
    });
    expect(ids(result[0]?.channels ?? [])).toEqual(["C3", "C1", "C2"]);
  });

  test("channel ids Slack lists but we do not know are skipped", () => {
    const result = build({
      channels: [channel("C1")],
      sections: [section("S1", "standard", ["GHOST", "C1"])],
    });
    expect(ids(result[0]?.channels ?? [])).toEqual(["C1"]);
  });

  test("DMs in a custom section keep their place and obey the section filter", () => {
    const result = build({
      channels: [],
      dms: ["D1", "D2"],
      sections: [section("S1", "standard", ["D1", "D2"], { sidebar: "hid" })],
      unread: ["D2"],
    });
    expect(result[0]?.dmIds).toEqual(["D2"]);
  });

  test("empty usergroup sections are dropped but empty standard ones stay", () => {
    const result = build({
      channels: [],
      hasDms: false,
      sections: [section("U1", "usergroup", []), section("S1", "standard", [])],
    });
    expect(result.map((c) => c.id)).toEqual(["S1"]);
  });

  test("typed built-in sections replace the appended ones", () => {
    const result = build({
      channels: [channel("C1")],
      dms: ["D1"],
      sections: [
        section("T1", "channels", [], { sidebar: "all" }),
        section("T2", "direct_messages", []),
        section("T3", "recent_apps", []),
      ],
    });
    expect(result.map((c) => [c.id, c.name, c.reorderable])).toEqual([
      ["T1", "Channels", true],
      ["T2", "Direct messages", true],
      ["T3", "Apps", true],
    ]);
    expect(ids(result[0]?.channels ?? [])).toEqual(["C1"]);
  });
});
