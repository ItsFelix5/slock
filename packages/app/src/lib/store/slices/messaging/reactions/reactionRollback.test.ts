// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { restoreFailedReaction } from "./reactionRollback";

describe("restoreFailedReaction", () => {
  test("rolls back only the failed emoji and preserves newer reactions", () => {
    const previous = { count: 1, name: "eyes", users: ["U2"] };
    const current = [
      { count: 2, name: "eyes", users: ["U1", "U2"] },
      { count: 1, name: "wave", users: ["U1"] },
    ];

    expect(restoreFailedReaction(current, "eyes", previous, 0)).toEqual([
      previous,
      { count: 1, name: "wave", users: ["U1"] },
    ]);
  });

  test("removes a failed newly-added reaction without clearing other emoji", () => {
    expect(
      restoreFailedReaction(
        [
          { count: 1, name: "eyes", users: ["U1"] },
          { count: 1, name: "wave", users: ["U2"] },
        ],
        "eyes",
        undefined,
        -1,
      ),
    ).toEqual([{ count: 1, name: "wave", users: ["U2"] }]);
  });
});
