import { describe, expect, test } from "bun:test";
import { forAll, int } from "@slock/core/testing";
import {
  type Crop,
  constrainCrop,
  cornerAnchor,
  cropDrawRect,
  initialCrop,
  nudgeCrop,
  profilePhotoName,
  resizeFromAnchor,
} from "../../../../src/profile/client/views/photoCrop";

const landscape = { height: 600, width: 1000 };
const portrait = { height: 1000, width: 400 };

describe("initialCrop", () => {
  test("is the centered largest square", () => {
    expect(initialCrop(landscape)).toEqual({ size: 600, x: 200, y: 0 });
    expect(initialCrop(portrait)).toEqual({ size: 400, x: 0, y: 300 });
    expect(initialCrop({ height: 50, width: 50 })).toEqual({ size: 50, x: 0, y: 0 });
  });
});

describe("constrainCrop", () => {
  test("keeps a valid crop and snaps near edges", () => {
    expect(constrainCrop({ size: 300, x: 100, y: 100 }, landscape)).toEqual({
      size: 300,
      x: 100,
      y: 100,
    });
    expect(constrainCrop({ size: 300, x: 10, y: 290 }, landscape)).toEqual({
      size: 300,
      x: 0,
      y: 300,
    });
  });

  test("never shrinks below 64 pixels, or below a tiny image", () => {
    expect(constrainCrop({ size: 3, x: 100, y: 100 }, landscape).size).toBe(64);
    expect(constrainCrop({ size: 3, x: 0, y: 0 }, { height: 30, width: 40 }).size).toBe(30);
  });

  test("caps growth at 1.6 times the long side", () => {
    expect(constrainCrop({ size: 99999, x: 0, y: 0 }, landscape).size).toBe(1600);
  });

  test("lets the crop overhang by at most 18 percent", () => {
    const far = constrainCrop({ size: 300, x: -9999, y: 9999 }, landscape);
    expect(far.x).toBeCloseTo(-54);
    expect(far.y).toBeCloseTo(600 - 300 * 0.82);
  });

  test("centers on an axis where the crop is too large to keep 82 percent inside", () => {
    const panorama = { height: 318, width: 3057 };
    const crop = constrainCrop({ size: 2147, x: -2768, y: -263 }, panorama);
    expect(crop.y).toBeCloseTo((318 - 2147) / 2);
  });

  test("is idempotent and always stays inside the overhang box", () => {
    forAll(
      (random) => ({
        crop: {
          size: int(random, -50, 3000),
          x: int(random, -3000, 3000),
          y: int(random, -3000, 3000),
        },
        source: { height: int(random, 20, 4000), width: int(random, 20, 4000) },
      }),
      ({ crop, source }) => {
        const once = constrainCrop(crop, source);
        expect(constrainCrop(once, source)).toEqual(once);
        expect(once.size).toBeGreaterThan(0);
        const snap = Math.min(source.width, source.height) * 0.04;
        const roomX = source.width - once.size * 0.82;
        const roomY = source.height - once.size * 0.82;
        if (roomX >= -once.size * 0.18) {
          expect(once.x).toBeGreaterThanOrEqual(-once.size * 0.18 - snap);
          expect(once.x).toBeLessThanOrEqual(roomX + snap);
        }
        if (roomY >= -once.size * 0.18) {
          expect(once.y).toBeGreaterThanOrEqual(-once.size * 0.18 - snap);
          expect(once.y).toBeLessThanOrEqual(roomY + snap);
        }
      },
    );
  });
});

describe("corner resize", () => {
  const crop: Crop = { size: 200, x: 100, y: 50 };

  test("anchors the opposite corner", () => {
    expect(cornerAnchor(crop, { x: -1, y: -1 })).toEqual({ x: 300, y: 250 });
    expect(cornerAnchor(crop, { x: 1, y: 1 })).toEqual({ x: 100, y: 50 });
    expect(cornerAnchor(crop, { x: 1, y: -1 })).toEqual({ x: 100, y: 250 });
  });

  test("dragging keeps the anchor fixed and the crop square", () => {
    forAll(
      (random) => ({
        cornerX: int(random, 0, 1) === 0 ? (-1 as const) : (1 as const),
        cornerY: int(random, 0, 1) === 0 ? (-1 as const) : (1 as const),
        px: int(random, -500, 1500),
        py: int(random, -500, 1500),
      }),
      ({ cornerX, cornerY, px, py }) => {
        const corner = { x: cornerX, y: cornerY };
        const anchor = cornerAnchor(crop, corner);
        const next = resizeFromAnchor(anchor, corner, { x: px, y: py });
        const fixedX = corner.x === -1 ? next.x + next.size : next.x;
        const fixedY = corner.y === -1 ? next.y + next.size : next.y;
        expect(fixedX).toBe(anchor.x);
        expect(fixedY).toBe(anchor.y);
        expect(next.size).toBeGreaterThanOrEqual(0);
      },
    );
  });

  test("uses the larger pointer distance as the size", () => {
    expect(resizeFromAnchor({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 30, y: 80 }).size).toBe(80);
  });
});

describe("nudgeCrop", () => {
  const crop: Crop = { size: 300, x: 200, y: 100 };

  test("arrows move by two percent of the short side", () => {
    expect(nudgeCrop(crop, "ArrowRight", false, landscape)).toEqual({ size: 300, x: 212, y: 100 });
    expect(nudgeCrop(crop, "ArrowUp", false, landscape)).toEqual({ size: 300, x: 200, y: 88 });
  });

  test("shift arrows grow and shrink around the center", () => {
    const bigger = nudgeCrop(crop, "ArrowRight", true, landscape);
    expect(bigger).toEqual({ size: 324, x: 188, y: 88 });
    const smaller = nudgeCrop(crop, "ArrowLeft", true, landscape);
    expect(smaller).toEqual({ size: 276, x: 212, y: 112 });
  });

  test("ignores other keys", () => {
    expect(nudgeCrop(crop, "a", false, landscape)).toBeUndefined();
    expect(nudgeCrop(crop, "Enter", true, landscape)).toBeUndefined();
  });

  test("holding a key cannot push the crop out of bounds", () => {
    let value: Crop = crop;
    for (let i = 0; i < 500; i++) value = nudgeCrop(value, "ArrowLeft", false, landscape) ?? value;
    expect(value.x).toBeGreaterThanOrEqual(-value.size * 0.18);
    for (let i = 0; i < 500; i++) value = nudgeCrop(value, "ArrowDown", true, landscape) ?? value;
    expect(value.size).toBeLessThanOrEqual(1600);
  });
});

describe("cropDrawRect", () => {
  test("a crop inside the image draws without padding", () => {
    expect(cropDrawRect({ size: 256, x: 100, y: 50 }, landscape, 512)).toEqual({
      destHeight: 512,
      destWidth: 512,
      destX: 0,
      destY: 0,
      sourceHeight: 256,
      sourceWidth: 256,
      sourceX: 100,
      sourceY: 50,
    });
  });

  test("a crop hanging over the edge leaves transparent padding", () => {
    const rect = cropDrawRect({ size: 200, x: -50, y: 0 }, landscape, 400);
    expect(rect).toMatchObject({ destWidth: 300, destX: 100, sourceWidth: 150, sourceX: 0 });
  });

  test("a crop fully outside the image draws nothing", () => {
    expect(cropDrawRect({ size: 100, x: 1200, y: 0 }, landscape, 512)).toBeUndefined();
    expect(cropDrawRect({ size: 100, x: -100, y: 0 }, landscape, 512)).toBeUndefined();
  });

  test("drawn pixels never exceed the output canvas", () => {
    forAll(
      (random) => ({
        crop: constrainCrop(
          { size: int(random, 64, 2000), x: int(random, -500, 1500), y: int(random, -500, 1000) },
          landscape,
        ),
      }),
      ({ crop }) => {
        const rect = cropDrawRect(crop, landscape, 512);
        if (!rect) return;
        expect(rect.destX).toBeGreaterThanOrEqual(0);
        expect(rect.destY).toBeGreaterThanOrEqual(0);
        expect(rect.destX + rect.destWidth).toBeLessThanOrEqual(512 + 1e-6);
        expect(rect.destY + rect.destHeight).toBeLessThanOrEqual(512 + 1e-6);
      },
    );
  });
});

describe("profilePhotoName", () => {
  test.each([
    ["me.jpg", "me-profile.png"],
    ["my.photo.final.jpeg", "my.photo.final-profile.png"],
    ["noext", "noext-profile.png"],
    [".hidden", ".hidden-profile.png"],
    ["emoji😀.webp", "emoji😀-profile.png"],
  ])("%s becomes %s", (input, expected) => {
    expect(profilePhotoName(input)).toBe(expected);
  });
});
