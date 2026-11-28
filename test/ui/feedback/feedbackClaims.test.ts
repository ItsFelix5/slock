import { describe, expect, test } from "bun:test";
import { claimFeedback } from "../../../packages/ui/src/feedback/feedbackClaims";

const feedback = { kind: "success", text: "Saved" } as const;

function claimant(priority: number) {
  const log: boolean[] = [];
  const release = claimFeedback(feedback, Symbol("claimant"), priority, (selected) =>
    log.push(selected),
  );
  return { last: () => log.at(-1), release };
}

describe("claimFeedback", () => {
  test("a lone claimant is selected", () => {
    const only = claimant(0);
    expect(only.last()).toBe(true);
    only.release();
  });

  test("the highest priority is selected and the rest are not", () => {
    const low = claimant(0);
    const high = claimant(2);
    expect(high.last()).toBe(true);
    expect(low.last()).toBe(false);
    low.release();
    high.release();
  });

  test("on equal priority the earliest claimant keeps the feedback", () => {
    const first = claimant(1);
    const second = claimant(1);
    expect(first.last()).toBe(true);
    expect(second.last()).toBe(false);
    first.release();
    second.release();
  });

  test("releasing the winner hands the feedback to the next claimant", () => {
    const low = claimant(0);
    const high = claimant(2);
    high.release();
    expect(low.last()).toBe(true);
    low.release();
  });

  test("releasing deselects the releasing claimant", () => {
    const only = claimant(0);
    only.release();
    expect(only.last()).toBe(false);
  });

  test("feedback objects do not compete with each other", () => {
    const other = { kind: "error", text: "Failed" } as const;
    const first = claimant(0);
    const log: boolean[] = [];
    const release = claimFeedback(other, Symbol("other"), 0, (selected) => log.push(selected));
    expect(first.last()).toBe(true);
    expect(log.at(-1)).toBe(true);
    first.release();
    release();
  });
});
