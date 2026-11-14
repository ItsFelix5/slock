import { describe, expect, test } from "bun:test";
import { forAll, int } from "@slock/core/testing";
import type { LayoutFrame } from "@slock/types";
import {
  framesFromAttribute,
  layoutAttribute,
  sameFrames,
  withCallout,
  withQuote,
} from "../../../src/canvas/protocol/frames.ts";

const quote: LayoutFrame = { kind: "quote" };
const callout = (color: number): LayoutFrame => ({ color, kind: "callout" });

describe("layout attribute", () => {
  test("quote and callouts round trip", () => {
    forAll(
      (random) => {
        const frames: LayoutFrame[] = [];
        if (int(random, 0, 1) === 1) frames.push(quote);
        if (int(random, 0, 1) === 1) frames.push(callout(int(random, 0, 8)));
        return frames;
      },
      (frames) => {
        expect(framesFromAttribute(layoutAttribute(frames))).toEqual(frames);
      },
    );
  });

  test("columns are not part of the attribute", () => {
    const frames: LayoutFrame[] = [{ id: "x", index: 0, kind: "columns", weights: [3, 3] }, quote];
    expect(layoutAttribute(frames)).toBe("quote");
  });

  test("garbage attributes yield no frames", () => {
    for (const value of [undefined, null, 4, "", "callout:", "callout:x", "callout:1.5", "nope"])
      expect(framesFromAttribute(value)).toEqual([]);
  });

  test("keeps well formed parts around garbage", () => {
    expect(framesFromAttribute("quote/callout:/callout:2")).toEqual([quote, callout(2)]);
  });
});

describe("withQuote and withCallout", () => {
  test("toggling twice restores the frames", () => {
    expect(withQuote(withQuote([callout(1)], true), false)).toEqual([callout(1)]);
    expect(withCallout(withCallout([quote], 3), null)).toEqual([quote]);
  });

  test("callout always sits outside and quote inside", () => {
    expect(withCallout(withQuote([], true), 2)).toEqual([callout(2), quote]);
  });

  test("replacing a callout keeps one", () => {
    expect(withCallout([callout(1)], 4)).toEqual([callout(4)]);
  });
});

describe("sameFrames", () => {
  test("compares column weights and index", () => {
    const columns = (index: number, weights: number[]): LayoutFrame => ({
      id: "c",
      index,
      kind: "columns",
      weights,
    });
    expect(sameFrames([columns(0, [3, 3])], [columns(0, [3, 3])])).toBe(true);
    expect(sameFrames([columns(0, [3, 3])], [columns(1, [3, 3])])).toBe(false);
    expect(sameFrames([columns(0, [3, 3])], [columns(0, [2, 4])])).toBe(false);
  });

  test("differs by length, kind and color", () => {
    expect(sameFrames([], [quote])).toBe(false);
    expect(sameFrames([quote], [callout(1)])).toBe(false);
    expect(sameFrames([callout(1)], [callout(2)])).toBe(false);
  });
});
