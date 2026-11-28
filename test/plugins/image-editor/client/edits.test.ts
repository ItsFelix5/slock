import { describe, expect, test } from "bun:test";
import {
  cropRect,
  defaultEdits,
  editedFileName,
  MAX_KEPT,
  selectedFrames,
  setCrop,
  setTrim,
  wrapLines,
} from "../../../../packages/plugins/src/image-editor/client/lib/edits";

const measure = (line: string) => line.length * 10;

describe("wrapLines", () => {
  test("breaks greedily on words", () => {
    expect(wrapLines("one two three four", measure, 80)).toEqual(["one two", "three", "four"]);
  });

  test("keeps an over-long word on its own line", () => {
    expect(wrapLines("a supercalifragilistic b", measure, 50)).toEqual([
      "a",
      "supercalifragilistic",
      "b",
    ]);
  });

  test("returns nothing for blank text", () => {
    expect(wrapLines("   ", measure, 100)).toEqual([]);
  });
});

describe("crop", () => {
  test("cropRect trims each side by its fraction", () => {
    expect(cropRect({ bottom: 0.25, left: 0.1, right: 0.1, top: 0.25 }, 200, 100)).toEqual({
      height: 50,
      width: 160,
      x: 20,
      y: 25,
    });
  });

  test("cropRect never collapses to nothing", () => {
    expect(cropRect({ bottom: 1, left: 0, right: 1, top: 0 }, 10, 10)).toMatchObject({
      height: 1,
      width: 1,
    });
  });

  test("setCrop keeps the opposite side from crossing", () => {
    const crop = setCrop({ bottom: 0, left: 0.5, right: 0, top: 0 }, "right", 0.9);
    expect(crop.right).toBeCloseTo(MAX_KEPT - 0.5);
  });

  test("setCrop clamps below zero", () => {
    expect(setCrop(defaultEdits(1).crop, "top", -1).top).toBe(0);
  });
});

describe("trim and speed", () => {
  const frames = [{ delay: 100 }, { delay: 100 }, { delay: 40 }, { delay: 100 }];

  test("selects the trimmed range", () => {
    const edits = { ...defaultEdits(4), end: 2, start: 1 };
    expect(selectedFrames(frames, edits)).toHaveLength(2);
  });

  test("speed scales delays and floors them", () => {
    const edits = { ...defaultEdits(4), speed: 3 };
    expect(selectedFrames(frames, edits).map((f) => f.delay)).toEqual([33, 33, 20, 33]);
  });

  test("setTrim drags the other edge along", () => {
    const edits = { ...defaultEdits(4), end: 1, start: 0 };
    expect(setTrim(edits, "start", 3, 3)).toMatchObject({ end: 3, start: 3 });
    expect(setTrim({ ...edits, start: 1 }, "end", 0, 3)).toMatchObject({ end: 0, start: 0 });
  });

  test("setTrim stays inside the frame range", () => {
    expect(setTrim(defaultEdits(4), "end", 99, 3).end).toBe(3);
  });
});

describe("editedFileName", () => {
  test("keeps the base name and swaps the extension", () => {
    expect(editedFileName("cat.jpeg", "jpg")).toBe("cat.jpg");
    expect(editedFileName("tenor.gif", "gif")).toBe("tenor.gif");
    expect(editedFileName("", "png")).toBe("image.png");
  });
});
