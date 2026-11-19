import { describe, expect, test } from "bun:test";
import { parseManifest } from "../src/host/manifest";
import { forAll, int, pick, text } from "../src/testing";

describe("parseManifest", () => {
  test("reads a full manifest", () => {
    expect(
      parseManifest({
        core: true,
        defaultEnabled: false,
        hidden: true,
        id: "messages",
        name: "Messages",
        provides: ["message-links"],
        requires: ["slack", "channels"],
      }),
    ).toEqual({
      core: true,
      defaultEnabled: false,
      hidden: true,
      id: "messages",
      name: "Messages",
      provides: ["message-links"],
      requires: ["slack", "channels"],
    });
  });

  test("a bare id gets empty lists and no flags", () => {
    expect(parseManifest({ id: "a" })).toEqual({
      core: undefined,
      defaultEnabled: undefined,
      hidden: undefined,
      id: "a",
      name: undefined,
      provides: [],
      requires: [],
    });
  });

  test("rejects anything without a string id", () => {
    const rejected = [null, undefined, 0, "id", [], [{ id: "a" }], {}, { id: 1 }, { id: null }];
    for (const value of rejected)
      expect(() => parseManifest(value)).toThrow("plugin manifest needs an id");
  });

  test("flags only count with their one meaningful value", () => {
    const parsed = parseManifest({ core: "true", defaultEnabled: true, hidden: 1, id: "a" });
    expect(parsed.core).toBeUndefined();
    expect(parsed.defaultEnabled).toBeUndefined();
    expect(parsed.hidden).toBeUndefined();
    expect(parseManifest({ core: false, hidden: false, id: "a" }).core).toBeUndefined();
  });

  test("lists drop non-strings and keep order and duplicates", () => {
    expect(parseManifest({ id: "a", requires: ["x", 1, null, "y", ["z"], "x"] }).requires).toEqual([
      "x",
      "y",
      "x",
    ]);
  });

  test("a list that is not an array becomes empty", () => {
    expect(parseManifest({ id: "a", provides: "slack", requires: { 0: "x" } })).toMatchObject({
      provides: [],
      requires: [],
    });
  });

  test("a name that is not a string is dropped", () => {
    expect(parseManifest({ id: "a", name: 5 }).name).toBeUndefined();
  });

  test("ignores unknown keys", () => {
    expect(Object.keys(parseManifest({ extra: 1, id: "a" })).sort()).toEqual([
      "core",
      "defaultEnabled",
      "hidden",
      "id",
      "name",
      "provides",
      "requires",
    ]);
  });

  test("only ever fails for a missing id, whatever else is in there", () => {
    const junk = [null, 0, 1.5, "", "x", true, [], {}, [1, "a", null], { id: 1 }];
    forAll(
      (random) => ({
        id: random() < 0.5 ? text(random, "abc-", 8) : pick(random, junk),
        name: pick(random, junk),
        provides: pick(random, junk),
        requires: Array.from({ length: int(random, 0, 4) }, () => pick(random, junk)),
      }),
      (value) => {
        if (typeof value.id === "string") {
          const parsed = parseManifest(value);
          expect(parsed.id).toBe(value.id);
          expect((parsed.requires ?? []).every((item) => typeof item === "string")).toBe(true);
          return;
        }
        expect(() => parseManifest(value)).toThrow();
      },
    );
  });
});
