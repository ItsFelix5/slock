import { describe, expect, test } from "bun:test";
import { metricsAt } from "../../../packages/plugins/src/appearance/client/theme/keyframeMetrics";
import { forAll, int } from "../../support/core";

type Frame = { height: number; width: number };

const frames: [number, Frame][] = [
  [0, { height: 10, width: 100 }],
  [10, { height: 20, width: 200 }],
  [30, { height: 40, width: 0 }],
];

describe("metricsAt", () => {
  test("returns the keyframe values exactly at each keyframe", () => {
    for (const [at, frame] of frames) expect(metricsAt(frames, at)).toEqual(frame);
  });

  test("interpolates linearly inside a segment", () => {
    expect(metricsAt(frames, 5)).toEqual({ height: 15, width: 150 });
    expect(metricsAt(frames, 20)).toEqual({ height: 30, width: 100 });
  });

  test("clamps outside the keyframe range", () => {
    expect(metricsAt(frames, -50)).toEqual({ height: 10, width: 100 });
    expect(metricsAt(frames, 999)).toEqual({ height: 40, width: 0 });
  });

  test("stays between the surrounding keyframes", () => {
    forAll(
      (random) => int(random, -20, 50),
      (at) => {
        const result = metricsAt(frames, at);
        expect(result.height).toBeGreaterThanOrEqual(10);
        expect(result.height).toBeLessThanOrEqual(40);
        expect(result.width).toBeGreaterThanOrEqual(0);
        expect(result.width).toBeLessThanOrEqual(200);
      },
    );
  });

  test("does not mutate the keyframes", () => {
    const copy = structuredClone(frames);
    metricsAt(frames, 12);
    expect(frames).toEqual(copy);
  });
});
