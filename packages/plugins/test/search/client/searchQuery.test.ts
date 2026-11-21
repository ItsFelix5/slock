import { describe, expect, test } from "bun:test";
import { forAll, pick, text } from "@slock/core/testing";
import { buildSearchQuery, type SearchFilters } from "../../../src/search/client/searchQuery";

describe("buildSearchQuery", () => {
  test("no text and no filters is an empty query", () => {
    expect(buildSearchQuery("   ", {})).toBe("");
  });

  test("text comes first, trimmed, followed by filters", () => {
    expect(buildSearchQuery("  hello  ", { hasLink: true, isThread: true })).toBe(
      "hello has:link is:thread",
    );
  });

  test("entity filters use the wire token form", () => {
    expect(buildSearchQuery("", { fromUserId: "U1", inChannelId: "C1" })).toBe(
      "from:<@U1> in:<#C1>",
    );
  });

  test("false flags and missing values add nothing", () => {
    expect(buildSearchQuery("x", { after: "", hasPin: false, isSaved: false })).toBe("x");
  });

  test("every set filter appears exactly once", () => {
    const flags = ["hasLink", "hasStar", "hasPin", "hasReaction", "isThread", "isSaved"] as const;
    forAll(
      (random) => {
        const filters: SearchFilters = {};
        for (const flag of flags) if (pick(random, [true, false])) filters[flag] = true;
        if (pick(random, [true, false])) filters.after = "2026-01-01";
        if (pick(random, [true, false])) filters.before = "2026-02-01";
        return { filters, query: text(random, "abc ", 8).trim() };
      },
      ({ filters, query }) => {
        const tokens = buildSearchQuery(query, filters).split(" ").filter(Boolean);
        const words = query.split(" ").filter(Boolean).length;
        expect(tokens).toHaveLength(Object.values(filters).filter(Boolean).length + words);
      },
    );
  });
});
