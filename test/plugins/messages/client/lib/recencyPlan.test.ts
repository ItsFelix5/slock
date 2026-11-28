import { describe, expect, test } from "bun:test";
import { planRecencyEviction } from "../../../../../packages/plugins/src/messages/client/lib/recencyEviction";

describe("planRecencyEviction", () => {
  test("retains the most recently hidden keys and evicts the rest", () => {
    expect(planRecencyEviction(["a", "b", "c"], ["c"], 1)).toEqual({
      evict: ["b"],
      recent: ["c", "a"],
    });
  });

  test("visible keys come first and are never evicted", () => {
    expect(planRecencyEviction(["a", "b"], ["b", "x"], 0)).toEqual({
      evict: ["a"],
      recent: ["b", "x"],
    });
  });

  test("a keep of zero forgets every hidden key", () => {
    expect(planRecencyEviction(["a", "b"], [], 0)).toEqual({ evict: ["a", "b"], recent: [] });
  });

  test("a key that is shown again leaves the hidden list", () => {
    expect(planRecencyEviction(["a", "b"], ["a"], 5)).toEqual({ evict: [], recent: ["a", "b"] });
  });

  test("duplicate visible keys collapse", () => {
    expect(planRecencyEviction([], ["a", "a"], 1).recent).toEqual(["a"]);
  });
});
