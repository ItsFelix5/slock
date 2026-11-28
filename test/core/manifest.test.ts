import { describe, expect, test } from "bun:test";
import { parseManifest, readManifest } from "../../packages/core/src/host/manifest";
import { forAll, int, pick, text } from "../support/core";

function manifestOf(value: unknown) {
  const result = parseManifest(value);
  if (!result.ok) throw new Error(result.errors.join(", "));
  return result.manifest;
}

function errorsOf(value: unknown) {
  const result = parseManifest(value);
  if (result.ok) throw new Error("expected the manifest to be rejected");
  return result.errors;
}

describe("parseManifest", () => {
  test("reads a full manifest", () => {
    expect(
      manifestOf({
        boot: true,
        category: "Read",
        hidden: true,
        id: "messages",
        name: "Messages",
        provides: ["message-links"],
        requires: ["slack", "channels"],
      }),
    ).toEqual({
      boot: true,
      category: "Read",
      hidden: true,
      id: "messages",
      name: "Messages",
      provides: ["message-links"],
      requires: ["slack", "channels"],
    });
  });

  test("a bare id gets empty lists and no flags", () => {
    expect(manifestOf({ id: "a" })).toEqual({
      boot: undefined,
      hidden: undefined,
      id: "a",
      name: undefined,
      provides: [],
      requires: [],
    });
  });

  test("rejects anything without a string id", () => {
    const rejected = [{}, { id: 1 }, { id: null }];
    for (const value of rejected) expect(errorsOf(value)).toEqual(["id must be a string"]);
  });

  test("rejects values that are not objects", () => {
    for (const value of [null, undefined, 0, "id", [], [{ id: "a" }]])
      expect(errorsOf(value)).toEqual(["manifest must be an object"]);
  });

  test("rejects ids that are not lowercase slugs", () => {
    for (const id of ["", "Slack", "a b", "-a", "a/b", "a.b", "a_b"])
      expect(errorsOf({ id })).toEqual(["id must be lowercase letters, digits and -"]);
  });

  test("flags must be booleans and only count with their one meaningful value", () => {
    expect(errorsOf({ boot: "true", hidden: 1, id: "a" })).toEqual([
      "boot must be true or false",
      "hidden must be true or false",
    ]);
    const parsed = manifestOf({ boot: false, hidden: false, id: "a" });
    expect(parsed.boot).toBeUndefined();
    expect(parsed.hidden).toBeUndefined();
  });

  test("lists must hold only strings, and order and duplicates are kept", () => {
    expect(errorsOf({ id: "a", requires: ["x", 1] })).toEqual([
      "requires must be a list of strings",
    ]);
    expect(manifestOf({ id: "a", requires: ["x", "y", "x"] }).requires).toEqual(["x", "y", "x"]);
  });

  test("a list that is not an array is rejected", () => {
    expect(errorsOf({ id: "a", provides: "slack", requires: { 0: "x" } })).toEqual([
      "provides must be a list of strings",
      "requires must be a list of strings",
    ]);
  });

  test("a name that is not a string is rejected", () => {
    expect(errorsOf({ id: "a", name: 5 })).toEqual(["name must be a string"]);
  });

  test("every problem is reported at once", () => {
    expect(errorsOf({ boot: 1, id: 7, name: 5, provides: 1, requires: 2 })).toHaveLength(5);
  });

  test("ignores unknown keys", () => {
    expect(Object.keys(manifestOf({ extra: 1, id: "a" })).sort()).toEqual([
      "boot",
      "category",
      "hidden",
      "id",
      "name",
      "provides",
      "requires",
    ]);
  });

  test("never throws, and accepts exactly the manifests with clean fields", () => {
    const junk = [null, 0, 1.5, "", "x", true, [], {}, [1, "a", null], { id: 1 }];
    forAll(
      (random) => ({
        id: random() < 0.5 ? text(random, "abc-", 8) : pick(random, junk),
        name: pick(random, junk),
        provides: pick(random, junk),
        requires: Array.from({ length: int(random, 0, 4) }, () => pick(random, junk)),
      }),
      (value) => {
        const result = parseManifest(value);
        const clean =
          typeof value.id === "string" &&
          /^[a-z0-9][a-z0-9-]*$/.test(value.id) &&
          typeof value.name === "string" &&
          Array.isArray(value.provides) &&
          value.provides.every((item) => typeof item === "string") &&
          value.requires.every((item) => typeof item === "string");
        expect(result.ok).toBe(clean);
      },
    );
  });
});

describe("readManifest", () => {
  test("returns the manifest", () => {
    expect(readManifest({ id: "a" }, "a/plugin.json").id).toBe("a");
  });

  test("names the source and every problem when it fails", () => {
    expect(() => readManifest({ id: "A", name: 1 }, "a/plugin.json")).toThrow(
      "a/plugin.json: name must be a string, id must be lowercase letters, digits and -",
    );
  });
});
