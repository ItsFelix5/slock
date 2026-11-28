import { describe, expect, test } from "bun:test";
import {
  BAR_COUNT,
  downloadName,
  resample,
} from "../../../../../packages/plugins/src/message-media/client/api/audioFileData";
import { forAll, int } from "../../../../support/core";

const file = (fields: { filetype?: string; title?: string }) => ({ name: "clip.mp4", ...fields });

describe("downloadName", () => {
  test.each([
    [{}, "clip.mp4"],
    [{ filetype: "m4a", title: "Standup notes" }, "Standup notes.m4a"],
    [{ filetype: "m4a", title: "Standup notes.m4a" }, "Standup notes.m4a"],
    [{ filetype: "m4a", title: "Standup notes.M4A" }, "Standup notes.M4A"],
    [{ title: "Standup notes" }, "Standup notes"],
    [{ filetype: "mp4", title: "" }, "clip.mp4"],
    [{ filetype: "ogg", title: "weekly sync \u{1f399}" }, "weekly sync \u{1f399}.ogg"],
  ])("%p becomes %p", (fields, expected) => {
    expect(downloadName(file(fields))).toBe(expected);
  });
});

describe("resample", () => {
  test("keeps short waveforms untouched", () => {
    expect(resample([])).toEqual([]);
    expect(resample([5, 9])).toEqual([5, 9]);
    const exact = Array.from({ length: BAR_COUNT }, (_, i) => i);
    expect(resample(exact)).toBe(exact);
  });

  test("averages equal chunks", () => {
    const raw = Array.from({ length: BAR_COUNT * 2 }, (_, i) => (i % 2 === 0 ? 10 : 30));
    expect(resample(raw)).toEqual(Array.from({ length: BAR_COUNT }, () => 20));
  });

  test("always yields BAR_COUNT bars within the input range", () => {
    forAll(
      (random) =>
        Array.from({ length: int(random, BAR_COUNT + 1, 500) }, () => int(random, 0, 100)),
      (raw) => {
        const bars = resample(raw);
        expect(bars).toHaveLength(BAR_COUNT);
        for (const bar of bars) {
          expect(bar).toBeGreaterThanOrEqual(Math.min(...raw));
          expect(bar).toBeLessThanOrEqual(Math.max(...raw));
        }
      },
    );
  });
});
