import { describe, expect, test } from "bun:test";
import { forAll, text } from "@slock/core/testing";
import { diffText } from "../../../src/message-logger/client/textDiff";

function applyBefore(segments: ReturnType<typeof diffText>) {
  return segments
    .filter((s) => s.kind !== "added")
    .map((s) => s.text)
    .join("");
}

function applyAfter(segments: ReturnType<typeof diffText>) {
  return segments
    .filter((s) => s.kind !== "removed")
    .map((s) => s.text)
    .join("");
}

describe("diffText", () => {
  test("identical text is one same segment", () => {
    expect(diffText("hello world", "hello world")).toEqual([{ kind: "same", text: "hello world" }]);
  });

  test("empty on either side", () => {
    expect(diffText("", "")).toEqual([]);
    expect(diffText("", "new")).toEqual([{ kind: "added", text: "new" }]);
    expect(diffText("old", "")).toEqual([{ kind: "removed", text: "old" }]);
  });

  test("marks a replaced word", () => {
    expect(diffText("see you at five", "see you at six")).toEqual([
      { kind: "same", text: "see you at " },
      { kind: "removed", text: "five" },
      { kind: "added", text: "six" },
    ]);
  });

  test("emoji codes are single tokens", () => {
    const segments = diffText("hi :tada:", "hi :partying_face:");
    expect(segments.at(-2)).toEqual({ kind: "removed", text: ":tada:" });
    expect(segments.at(-1)).toEqual({ kind: "added", text: ":partying_face:" });
  });

  test("unicode and emoji survive", () => {
    const segments = diffText("héllo 😀 wörld", "héllo 😎 wörld");
    expect(applyBefore(segments)).toBe("héllo 😀 wörld");
    expect(applyAfter(segments)).toBe("héllo 😎 wörld");
  });

  test("adjacent segments of the same kind are merged", () => {
    const segments = diffText("a b c", "x y z");
    for (let i = 1; i < segments.length; i++)
      expect(segments[i]?.kind).not.toBe(segments[i - 1]?.kind);
  });

  test("diffs reconstruct both sides for any pair of strings", () => {
    const alphabet = "ab :cd_é😀\n";
    forAll(
      (random) => ({ after: text(random, alphabet, 30), before: text(random, alphabet, 30) }),
      ({ before, after }) => {
        const segments = diffText(before, after);
        expect(applyBefore(segments)).toBe(before);
        expect(applyAfter(segments)).toBe(after);
        expect(segments.every((s) => s.text.length > 0)).toBe(true);
      },
    );
  });

  test("a long edit finishes quickly", () => {
    const before = Array.from({ length: 1500 }, (_, i) => `word${i}`).join(" ");
    const after = before.replace("word700", "changed");
    const started = performance.now();
    diffText(before, after);
    expect(performance.now() - started).toBeLessThan(2000);
  });
});
