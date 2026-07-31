// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import type { ChannelSection } from "@slock/slack-api";
import { reorderSections, sectionMoveTarget } from "./sectionOrder";

const section = (id: string): ChannelSection => ({
  channelIds: [],
  id,
  name: id,
  sidebar: "all",
  type: "standard",
});

describe("sectionMoveTarget", () => {
  const ids = ["one", "two", "three", "four"];

  test("maps accessible up and down actions to the API's next-section target", () => {
    expect(sectionMoveTarget(ids, "two", -1)).toBe("one");
    expect(sectionMoveTarget(ids, "two", 1)).toBe("four");
    expect(sectionMoveTarget(ids, "three", 1)).toBeNull();
  });

  test("rejects boundary and unknown moves", () => {
    expect(sectionMoveTarget(ids, "one", -1)).toBeUndefined();
    expect(sectionMoveTarget(ids, "four", 1)).toBeUndefined();
    expect(sectionMoveTarget(ids, "missing", 1)).toBeUndefined();
  });
});

describe("reorderSections", () => {
  const sections = [section("one"), section("two"), section("three")];

  test("moves a section immediately before the requested neighbor", () => {
    expect(reorderSections(sections, "three", "two")?.map((item) => item.id)).toEqual([
      "one",
      "three",
      "two",
    ]);
  });

  test("moves a section to the bottom when the neighbor is null", () => {
    expect(reorderSections(sections, "one", null)?.map((item) => item.id)).toEqual([
      "two",
      "three",
      "one",
    ]);
  });

  test("rejects missing targets and no-op drops", () => {
    expect(reorderSections(sections, "one", "missing")).toBeNull();
    expect(reorderSections(sections, "two", "three")).toBeNull();
  });
});
