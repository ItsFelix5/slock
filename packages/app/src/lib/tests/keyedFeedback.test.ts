// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { createKeyedFeedback } from "../../../../ui/src/feedback/keyedFeedback";

describe("createKeyedFeedback", () => {
  test("clears a stale message before a retried action starts", () => {
    const feedback = createKeyedFeedback(10_000);
    feedback.flash("navigation", "Couldn’t open that message.", "error");
    expect(feedback.get("navigation")?.kind).toBe("error");

    feedback.clear("navigation");

    expect(feedback.get("navigation")).toBeUndefined();
  });
});
