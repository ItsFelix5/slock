import { describe, expect, test } from "bun:test";
import { forAll, int, pick, text } from "@slock/core/testing";
import { fuzzySearch } from "../src/fuzzy";

const search = (items: string[], query: string) => fuzzySearch(items, { query, text: (s) => s });

describe("fuzzySearch ranking", () => {
  test("orders exact, prefix, word start, infix, then scattered", () => {
    const items = ["xxdevxx", "devops", "scattered-d-e-v", "my-dev", "dev"];
    expect(search(items, "dev")).toEqual(["dev", "devops", "my-dev", "xxdevxx", "scattered-d-e-v"]);
  });

  test("treats separators as word starts", () => {
    expect(search(["a_dev", "adev", "a.dev", "a/dev", "a dev"], "dev")).toEqual([
      "a_dev",
      "a.dev",
      "a/dev",
      "a dev",
      "adev",
    ]);
  });

  test("prefers the shorter prefix match", () => {
    expect(search(["general-long", "general"], "gen")).toEqual(["general", "general-long"]);
  });

  test("prefers the earlier infix match inside one tier", () => {
    expect(search(["xxxdev", "xdev"], "dev")).toEqual(["xdev", "xxxdev"]);
  });

  test("ranks word starts and runs above scattered letters", () => {
    expect(search(["axbyc", "abxcy", "a-b-c-x-y"], "abc")).toEqual(["a-b-c-x-y", "abxcy", "axbyc"]);
  });

  test("drops items that are not a subsequence", () => {
    expect(search(["abc", "acb", "bca"], "abc")).toEqual(["abc"]);
  });

  test("ignores case and surrounding whitespace in the query", () => {
    expect(search(["General", "random"], "  GEN ")).toEqual(["General"]);
  });

  test("returns a copy for an empty query", () => {
    const items = ["b", "a"];
    const result = search(items, "   ");
    expect(result).toEqual(items);
    expect(result).not.toBe(items);
  });
});

describe("fuzzySearch options", () => {
  const people = [
    { handle: "zed", name: "Alice Zed", priority: 0, uses: 0 },
    { handle: "al", name: "Alan", priority: 0, uses: 5 },
    { handle: "ali", name: "Alina", priority: 1, uses: 0 },
  ];
  const run = (query: string, extra: object = {}) =>
    fuzzySearch(people, { query, text: (p) => p.name, ...extra }).map((p) => p.name);

  test("priority beats frequency beats score inside a tier", () => {
    const options = { frequency: (p: (typeof people)[number]) => p.uses };
    expect(run("al", { ...options, priority: (p: (typeof people)[number]) => p.priority })).toEqual(
      ["Alina", "Alan", "Alice Zed"],
    );
    expect(run("al", options)).toEqual(["Alan", "Alina", "Alice Zed"]);
  });

  test("falls back to altText only when the main text misses", () => {
    expect(run("zed", { altText: (p: (typeof people)[number]) => p.handle })).toEqual([
      "Alice Zed",
    ]);
    expect(run("al", { altText: (p: (typeof people)[number]) => p.handle })).toEqual([
      "Alan",
      "Alina",
      "Alice Zed",
    ]);
  });

  test("an altText hit ranks below every direct hit", () => {
    const items = [
      { alt: "target", name: "nope" },
      { alt: "", name: "xx-target-xx" },
    ];
    const result = fuzzySearch(items, {
      altText: (i) => i.alt,
      query: "target",
      text: (i) => i.name,
    });
    expect(result.map((i) => i.name)).toEqual(["xx-target-xx", "nope"]);
  });
});

describe("fuzzySearch properties", () => {
  const alphabet = "ab-_ ./ÀÉ😀א";
  const scenario = (random: () => number) => ({
    items: Array.from({ length: int(random, 0, 12) }, () => text(random, alphabet, 8)),
    query: text(random, "abÀ😀א", 3),
  });

  test("results are an order-free subset with no invented items", () => {
    forAll(scenario, ({ items, query }) => {
      const result = search(items, query);
      expect(result.length).toBeLessThanOrEqual(items.length);
      for (const item of result) expect(items).toContain(item);
    });
  });

  test("every result contains the query as a subsequence", () => {
    forAll(scenario, ({ items, query }) => {
      const q = [...query.trim().toLowerCase()];
      for (const item of search(items, query)) {
        const chars = [...item.toLowerCase()];
        let at = 0;
        for (const char of chars) if (char === q[at]) at++;
        expect(at).toBe(q.length);
      }
    });
  });

  test("is idempotent", () => {
    forAll(scenario, ({ items, query }) => {
      const once = search(items, query);
      expect(search(once, query)).toEqual(once);
    });
  });

  test("an item equal to the query always comes first", () => {
    forAll(
      (random) => {
        const query = text(random, "abc", 4) || "a";
        return {
          items: [...Array.from({ length: 6 }, () => text(random, "abc-", 6)), query],
          query,
        };
      },
      ({ items, query }) => expect(search(items, query)[0]?.toLowerCase()).toBe(query),
    );
  });

  test("never throws on arbitrary unicode", () => {
    forAll(
      (random) => ({
        items: [pick(random, ["", "💥", "\u0000", "İstanbul", "ﷺ"]), text(random, "‮‍😀é", 10)],
        query: text(random, "‮‍😀é\\^$.*", 4),
      }),
      ({ items, query }) => {
        expect(() => search(items, query)).not.toThrow();
      },
    );
  });
});
