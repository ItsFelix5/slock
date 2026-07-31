// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { createCanvasEditorLoadTracker } from "./canvasEditorLoadTracker";

describe("createCanvasEditorLoadTracker", () => {
  test("reloads the same canvas after its editor was unmounted", () => {
    const tracker = createCanvasEditorLoadTracker();

    expect(tracker.shouldLoad("F123", true)).toBe(true);
    expect(tracker.shouldLoad("F123", true)).toBe(false);
    expect(tracker.shouldLoad(undefined, false)).toBe(false);
    expect(tracker.shouldLoad("F123", true)).toBe(true);
  });

  test("keeps a failed load retryable", () => {
    const tracker = createCanvasEditorLoadTracker();

    expect(tracker.shouldLoad("F123", false)).toBe(false);
    expect(tracker.shouldLoad("F123", true)).toBe(true);
  });

  test("loads a different canvas into the existing editor", () => {
    const tracker = createCanvasEditorLoadTracker();

    expect(tracker.shouldLoad("F123", true)).toBe(true);
    expect(tracker.shouldLoad("F456", true)).toBe(true);
  });
});
