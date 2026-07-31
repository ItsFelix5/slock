// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { removeSectionChannelsBatched } from "./sectionChannelRemovals";

describe("removeSectionChannelsBatched", () => {
  test("retains successful removals when another section request rejects", async () => {
    const errors: [string, unknown][] = [];
    const failure = new Error("network down");

    const removed = await removeSectionChannelsBatched(
      [
        ["direct", ["D1", "D2"]],
        ["custom", ["D3"]],
      ],
      (sectionId) => (sectionId === "direct" ? Promise.resolve(true) : Promise.reject(failure)),
      (sectionId, error) => errors.push([sectionId, error]),
    );

    expect([...removed]).toEqual(["D1", "D2"]);
    expect(errors).toEqual([["custom", failure]]);
  });

  test("does not count a fulfilled API-level failure as removed", async () => {
    const removed = await removeSectionChannelsBatched(
      [["direct", ["D1"]]],
      () => Promise.resolve(false),
      () => {},
    );

    expect(removed.size).toBe(0);
  });
});
