import { expect, test } from "bun:test";
import ts from "typescript";
import { ownedRuns } from "../../scripts/rules/ownedRun.ts";

function count(text: string): number {
  return ownedRuns(ts.createSourceFile("x.ts", text, ts.ScriptTarget.Latest, true)).length;
}

test("running a callback under an owner is flagged", () => {
  expect(count("runWithOwner(owner, onClose);")).toBe(1);
});

test("running under a null owner is allowed", () => {
  expect(count("runWithOwner(null, flush);")).toBe(0);
});
