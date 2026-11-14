import { describe, expect, test } from "bun:test";
import { forAll, int } from "@slock/core/testing";
import {
  EMOJI_COLUMNS,
  layoutChunks,
  scrollTopToReveal,
  visibleChunks,
} from "../../../../src/emoji/client/api/emojiGridLayout";

const entries = (count: number) => Array.from({ length: count }, (_, index) => index);

describe("layoutChunks", () => {
  test("empty list has no height", () => {
    expect(layoutChunks([])).toEqual({ chunks: [], totalHeight: 0 });
  });

  test("splits into 48 entry chunks that stack without gaps", () => {
    const { chunks, totalHeight } = layoutChunks(entries(100));
    expect(chunks.map((chunk) => chunk.entries.length)).toEqual([48, 48, 4]);
    expect(chunks.map((chunk) => chunk.startIndex)).toEqual([0, 48, 96]);
    expect(chunks[1]?.top).toBe(chunks[0]?.height ?? -1);
    expect(totalHeight).toBe(chunks.reduce((sum, chunk) => sum + chunk.height, 0));
  });

  test("a partial last row still takes a whole row", () => {
    const [chunk] = layoutChunks(entries(EMOJI_COLUMNS + 1)).chunks;
    expect(chunk?.height).toBe(32 * 2 + 2);
  });
});

describe("visibleChunks", () => {
  test("renders only chunks near the viewport and spacers cover the rest", () => {
    const layout = layoutChunks(entries(48 * 40));
    const view = visibleChunks(layout, 5000, 360);
    expect(view.list.length).toBeGreaterThan(0);
    expect(view.list.length).toBeLessThan(6);
    const rendered = view.list.reduce((sum, chunk) => sum + chunk.height, 0);
    expect(view.topSpacer + rendered + view.bottomSpacer).toBe(layout.totalHeight);
  });

  test("covers every scroll position without holes", () => {
    forAll(
      (random) => ({ count: int(random, 0, 3000), scroll: int(random, 0, 40000) }),
      ({ count, scroll }) => {
        const layout = layoutChunks(entries(count));
        const view = visibleChunks(layout, Math.min(scroll, layout.totalHeight), 360);
        const rendered = view.list.reduce((sum, chunk) => sum + chunk.height, 0);
        expect(view.topSpacer + rendered + view.bottomSpacer).toBe(layout.totalHeight);
      },
    );
  });
});

describe("scrollTopToReveal upwards", () => {
  test("puts the row top exactly where the chunk layout draws it", () => {
    forAll(
      (random) => int(random, 0, 3000),
      (index) => {
        const { chunks } = layoutChunks(entries(3001));
        const chunk = chunks.find(
          (c) => c.startIndex <= index && index < c.startIndex + c.entries.length,
        );
        const row = Math.floor((index - (chunk?.startIndex ?? 0)) / EMOJI_COLUMNS);
        const drawnTop = (chunk?.top ?? 0) + row * 34;
        expect(scrollTopToReveal(index, 1e9, 360)).toBe(drawnTop);
      },
    );
  });
});

describe("scrollTopToReveal", () => {
  test("keeps the scroll position when the row is visible", () => {
    expect(scrollTopToReveal(0, 0, 360)).toBe(0);
    expect(scrollTopToReveal(9, 10, 360)).toBe(10);
  });

  test("scrolls up to the row top and down to the row bottom", () => {
    expect(scrollTopToReveal(0, 500, 360)).toBe(0);
    expect(scrollTopToReveal(8 * 20, 0, 360)).toBe(20 * 34 - 3 * 2 + 32 - 360);
  });

  test("lands the row inside the rendered chunk for any index", () => {
    forAll(
      (random) => int(random, 0, 3000),
      (index) => {
        const layout = layoutChunks(entries(3001));
        const target = scrollTopToReveal(index, 0, 360);
        const view = visibleChunks(layout, target, 360);
        expect(
          view.list.some(
            (chunk) => chunk.startIndex <= index && index < chunk.startIndex + chunk.entries.length,
          ),
        ).toBe(true);
        const chunk = layout.chunks.find(
          (c) => c.startIndex <= index && index < c.startIndex + c.entries.length,
        );
        const row = Math.floor((index - (chunk?.startIndex ?? 0)) / EMOJI_COLUMNS);
        const rowBottom = (chunk?.top ?? 0) + row * 34 + 32;
        expect(rowBottom).toBeLessThanOrEqual(target + 360);
        expect(rowBottom).toBeGreaterThan(Math.max(0, target));
      },
    );
  });
});
