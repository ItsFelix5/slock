import { afterEach, beforeEach, expect, test } from "bun:test";
import { flush } from "solid-js";
import { createKeyedFeedback } from "../../../packages/ui/src/feedback/keyedFeedback";
import { startFakeEnv } from "../fakeEnv";

let fake: Awaited<ReturnType<typeof startFakeEnv>>;

beforeEach(async () => {
  fake = await startFakeEnv();
});
afterEach(() => fake.stop());

function advance(ms: number) {
  fake.env.advance(ms);
  flush();
}

test("each key expires on its own timer", () => {
  const feedback = createKeyedFeedback(1000);
  feedback.flash("a", "Saved");
  advance(600);
  feedback.flash("b", "Copied", "error");
  advance(400);
  expect(feedback.get("a")).toBeUndefined();
  expect(feedback.get("b")).toEqual({ kind: "error", text: "Copied" });
  advance(600);
  expect(feedback.get("b")).toBeUndefined();
});

test("flashing a key again restarts only that key", () => {
  const feedback = createKeyedFeedback(1000);
  feedback.flash("a", "Saved");
  advance(800);
  feedback.flash("a", "Saved again");
  feedback.flash("b", "Copied");
  advance(800);
  expect(feedback.get("a")).toEqual({ kind: "success", text: "Saved again" });
  expect(feedback.get("b")).toEqual({ kind: "success", text: "Copied" });
  advance(200);
  expect(feedback.get("a")).toBeUndefined();
  expect(feedback.get("b")).toBeUndefined();
});

test("clear drops one key and leaves the others until their expiry", () => {
  const feedback = createKeyedFeedback(1000);
  feedback.flash("a", "Saved");
  feedback.flash("b", "Copied");
  feedback.clear("a");
  flush();
  expect(feedback.get("a")).toBeUndefined();
  expect(feedback.get("b")).toEqual({ kind: "success", text: "Copied" });
  advance(1000);
  expect(feedback.get("b")).toBeUndefined();
});
