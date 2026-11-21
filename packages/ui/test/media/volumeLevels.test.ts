import { describe, expect, test } from "bun:test";
import { mediaLevels, volumeAfterMute, volumeAfterSet } from "../../src/media/video/volumeLevels";

describe("volumeAfterSet", () => {
  test("clamps into zero to max", () => {
    expect(volumeAfterSet(9, 5).volume).toBe(5);
    expect(volumeAfterSet(-1, 5).volume).toBe(0);
    expect(volumeAfterSet(2.5, 5).volume).toBe(2.5);
  });

  test("zero mutes and anything else unmutes", () => {
    expect(volumeAfterSet(0, 5).muted).toBe(true);
    expect(volumeAfterSet(0.1, 5).muted).toBe(false);
  });
});

describe("volumeAfterMute", () => {
  test("muting keeps the volume", () => {
    expect(volumeAfterMute({ muted: false, volume: 0.4 }, true)).toEqual({
      muted: true,
      volume: 0.4,
    });
  });

  test("unmuting from zero restores full volume", () => {
    expect(volumeAfterMute({ muted: true, volume: 0 }, false)).toEqual({
      muted: false,
      volume: 1,
    });
  });

  test("unmuting a remembered volume keeps it", () => {
    expect(volumeAfterMute({ muted: true, volume: 3 }, false).volume).toBe(3);
  });
});

describe("mediaLevels", () => {
  test("below full volume only the element changes", () => {
    expect(mediaLevels(0.5)).toEqual({ boosted: false, elementVolume: 0.5, gain: 1 });
  });

  test("above full volume the element is maxed and gain carries the boost", () => {
    expect(mediaLevels(3)).toEqual({ boosted: true, elementVolume: 1, gain: 3 });
  });

  test("exactly one is not boosted", () => {
    expect(mediaLevels(1).boosted).toBe(false);
  });
});
