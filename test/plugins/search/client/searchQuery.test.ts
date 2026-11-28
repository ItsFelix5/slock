import { describe, expect, test } from "bun:test";
import { parseChannelId } from "@slock/slack";
import {
  buildSearchQuery,
  DEFAULT_INPUTS,
  freeText,
  parseTokens,
  resolveRequest,
  type SearchInputs,
  withoutModifier,
} from "../../../../packages/plugins/src/search/client/searchQuery";

const resolve = (inputs: Partial<SearchInputs>, jumpOnly = false) =>
  resolveRequest({ ...DEFAULT_INPUTS, ...inputs }, jumpOnly);

describe("parseTokens", () => {
  test("modifiers only count at the start of a word", () => {
    expect(parseTokens("within:reason https://x.test/?type:pdf")).toEqual([]);
  });

  test("reads negation, case and entity values", () => {
    expect(
      parseTokens("-From:<@U1> hi").map(({ modifier, negated, value }) => ({
        modifier,
        negated,
        value,
      })),
    ).toEqual([{ modifier: "from", negated: true, value: "<@U1>" }]);
  });

  test("free text and modifier removal keep the rest", () => {
    expect(freeText("a has:link b")).toBe("a b");
    expect(withoutModifier("a type:pdfs in:#x", "type")).toBe("a in:#x");
  });
});

describe("resolveRequest", () => {
  test("a leading sigil picks the scope and leaves the query", () => {
    expect(resolve({ query: "@ann" })).toMatchObject({ query: "ann", scope: "people" });
    expect(resolve({ query: "#gen" })).toMatchObject({ query: "gen", scope: "channels" });
    expect(resolve({ query: "§plan" })).toMatchObject({ query: "plan", scope: "files" });
  });

  test("a sigil is plain text in an unrelated scope", () => {
    expect(resolve({ query: "#gen", scope: "messages" })).toMatchObject({
      query: "#gen",
      scope: "messages",
    });
  });

  test("modifiers move to the scope that understands them", () => {
    expect(resolve({ query: "type:pdfs" }).scope).toBe("files");
    expect(resolve({ query: "is:thread" }).scope).toBe("messages");
    expect(resolve({ query: "from:me" }).scope).toBe("messages");
    expect(resolve({ query: "from:me", scope: "files" }).scope).toBe("files");
    expect(resolve({ query: "plain" }).scope).toBe("all");
  });

  test("a filter without a value is not searched yet", () => {
    expect(resolve({ query: "test from:" })).toMatchObject({ query: "test", scope: "all" });
    expect(resolve({ query: "-in:# test from:@" }).query).toBe("test");
    expect(resolve({ query: "from:@ann" }).query).toBe("from:@ann");
  });

  test("picking a recipient never leaves the jump scopes", () => {
    expect(resolve({ query: "from:me" }, true).scope).toBe("all");
    expect(resolve({ query: "@ann" }, true).scope).toBe("people");
  });
});

describe("buildSearchQuery", () => {
  test("text comes first, then the channel filter", () => {
    expect(buildSearchQuery("  hello  ", parseChannelId("C1"))).toBe("hello in:<#C1>");
    expect(buildSearchQuery("   ")).toBe("");
  });
});
