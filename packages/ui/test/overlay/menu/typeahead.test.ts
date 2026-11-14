import { describe, expect, test } from "bun:test";
import { forAll, int, pick, text } from "@slock/core/testing";
import { isTypeaheadKey, pushTypeahead, typeaheadIndex } from "../../../src/overlay/menu/typeahead";

const labels = ["Copy link", "Copy text", "Delete", "Edit", "Pin to channel", "Pin message"];

describe("typeaheadIndex", () => {
  test.each([
    ["d", 0, 2],
    ["e", 0, 3],
    ["pin t", 0, 4],
    ["pin m", 0, 5],
    ["copy t", 0, 1],
  ])("query %p from %p finds %p", (query, current, expected) => {
    expect(typeaheadIndex(labels, query, current)).toBe(expected);
  });

  test("a repeated letter cycles through matches and wraps", () => {
    expect(typeaheadIndex(labels, "c", 0)).toBe(1);
    expect(typeaheadIndex(labels, "cc", 1)).toBe(0);
    expect(typeaheadIndex(labels, "p", 4)).toBe(5);
    expect(typeaheadIndex(labels, "p", 5)).toBe(4);
  });

  test("a multi letter query may stay on the focused item", () => {
    expect(typeaheadIndex(labels, "copy", 1)).toBe(1);
  });

  test("returns nothing without a match, labels or query", () => {
    expect(typeaheadIndex(labels, "zz", 0)).toBeUndefined();
    expect(typeaheadIndex([], "a", 0)).toBeUndefined();
    expect(typeaheadIndex(labels, "", 0)).toBeUndefined();
  });

  test("ignores case and surrounding whitespace in labels", () => {
    expect(typeaheadIndex(["  Émoji", "ÅNGSTRÖM"], "å", -1)).toBe(1);
    expect(typeaheadIndex(["  Émoji"], "é", -1)).toBe(0);
  });

  test("starts from the first item when nothing is focused", () => {
    expect(typeaheadIndex(labels, "c", -1)).toBe(0);
  });

  test("always returns an item that starts with the query", () => {
    const alphabet = "cdepi n";
    forAll(
      (random) => ({
        current: int(random, -1, labels.length - 1),
        query: text(random, alphabet, 4),
      }),
      ({ current, query }) => {
        const found = typeaheadIndex(labels, query, current);
        if (found === undefined) return;
        const label = labels[found]?.toLowerCase() ?? "";
        const needle = new Set(query).size === 1 ? query.slice(0, 1) : query;
        expect(label.startsWith(needle)).toBe(true);
      },
    );
  });

  test("never throws on garbage", () => {
    forAll(
      (random) => ({
        items: Array.from({ length: int(random, 0, 6) }, () => text(random, "ab😀 ", 5)),
        query: text(random, "ab😀", 4),
        current: int(random, -3, 8),
      }),
      ({ items, query, current }) => {
        const found = typeaheadIndex(items, query, current);
        if (found !== undefined) expect(found).toBeLessThan(items.length);
      },
    );
    expect(pick(() => 0, [1])).toBe(1);
  });
});

describe("pushTypeahead", () => {
  test("appends keys that arrive within the window", () => {
    let state = { buffer: "", time: Number.NEGATIVE_INFINITY };
    state = pushTypeahead(state, "P", 1000);
    state = pushTypeahead(state, "i", 1300);
    expect(state.buffer).toBe("pi");
  });

  test("starts over after a pause", () => {
    let state = { buffer: "", time: Number.NEGATIVE_INFINITY };
    state = pushTypeahead(state, "p", 1000);
    state = pushTypeahead(state, "d", 1600);
    expect(state.buffer).toBe("d");
  });
});

describe("isTypeaheadKey", () => {
  const key = (
    value: string,
    modifiers: Partial<Record<"altKey" | "ctrlKey" | "metaKey", boolean>> = {},
  ) => isTypeaheadKey({ altKey: false, ctrlKey: false, metaKey: false, key: value, ...modifiers });

  test("accepts printable characters", () => {
    expect(key("a")).toBe(true);
    expect(key("é")).toBe(true);
  });

  test("rejects space, named keys and modified keys", () => {
    expect(key(" ")).toBe(false);
    expect(key("ArrowDown")).toBe(false);
    expect(key("Enter")).toBe(false);
    expect(key("a", { ctrlKey: true })).toBe(false);
    expect(key("a", { metaKey: true })).toBe(false);
    expect(key("a", { altKey: true })).toBe(false);
  });
});
