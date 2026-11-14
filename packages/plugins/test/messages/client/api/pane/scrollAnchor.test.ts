import { describe, expect, test } from "bun:test";
import { forAll, int, pick, type Random } from "@slock/core/testing";
import {
  captureScrollAnchor,
  correctScrollAfterContentChange,
  isScrolledToBottom,
  restoreScrollAnchor,
  scrollToBottom,
} from "../../../../../src/messages/client/api/pane/scrollAnchor";
import {
  CONTAINER_TOP,
  createScrollFeed,
} from "../../../../../src/messages/client/api/pane/scrollFeedFixture";

const changes = ["prepend", "append", "grow", "resize"] as const;

const isClamped = (container: HTMLElement) =>
  container.scrollTop === 0 ||
  container.scrollTop === container.scrollHeight - container.clientHeight;

const heights = (random: Random, count: number) =>
  Array.from({ length: count }, () => int(random, 8, 200));

describe("isScrolledToBottom", () => {
  test("two pixels of slack by default", () => {
    const feed = createScrollFeed([500, 500], 400);
    feed.container.scrollTop = 600;
    expect(isScrolledToBottom(feed.container)).toBe(true);
    feed.container.scrollTop = 598;
    expect(isScrolledToBottom(feed.container)).toBe(true);
    feed.container.scrollTop = 597;
    expect(isScrolledToBottom(feed.container)).toBe(false);
    expect(isScrolledToBottom(feed.container, 3)).toBe(true);
  });

  test("a list shorter than the viewport counts as the bottom", () => {
    expect(isScrolledToBottom(createScrollFeed([50, 50], 600).container)).toBe(true);
    expect(isScrolledToBottom(createScrollFeed([], 600).container)).toBe(true);
  });

  test("scrollToBottom lands on the bottom whatever the heights", () => {
    forAll(
      (random) => ({ rows: heights(random, int(random, 1, 80)), viewport: int(random, 100, 900) }),
      ({ rows, viewport }) => {
        const feed = createScrollFeed(rows, viewport);
        scrollToBottom(feed.container);
        expect(isScrolledToBottom(feed.container, 0)).toBe(true);
      },
    );
  });
});

describe("captureScrollAnchor", () => {
  test("top edge picks the first row that still shows below the container top", () => {
    const feed = createScrollFeed(
      Array.from({ length: 20 }, () => 50),
      300,
    );
    feed.container.scrollTop = 125;
    const anchor = captureScrollAnchor(feed.container);
    expect(anchor?.el).toBe(feed.rows()[2]);
    expect(anchor?.offset).toBe(-25);
  });

  test("a row ending exactly on the top edge is not visible", () => {
    const feed = createScrollFeed(
      Array.from({ length: 20 }, () => 50),
      300,
    );
    feed.container.scrollTop = 100;
    const anchor = captureScrollAnchor(feed.container);
    expect(anchor?.el).toBe(feed.rows()[2]);
    expect(anchor?.offset).toBe(0);
  });

  test("bottom edge picks the last row that starts above the container bottom", () => {
    const feed = createScrollFeed(
      Array.from({ length: 20 }, () => 50),
      200,
    );
    expect(captureScrollAnchor(feed.container, "bottom")?.el).toBe(feed.rows()[3]);
    feed.container.scrollTop = 25;
    expect(captureScrollAnchor(feed.container, "bottom")?.el).toBe(feed.rows()[4]);
  });

  test("an empty list has no anchor", () => {
    const feed = createScrollFeed([], 300);
    expect(captureScrollAnchor(feed.container)).toBeNull();
    expect(captureScrollAnchor(feed.container, "bottom")).toBeNull();
  });

  test("a short list anchors on its first and last rows", () => {
    const feed = createScrollFeed([40, 40, 40], 600);
    expect(captureScrollAnchor(feed.container)?.el).toBe(feed.rows()[0]);
    expect(captureScrollAnchor(feed.container, "bottom")?.el).toBe(feed.rows()[2]);
  });

  test("agrees with a linear scan for any layout and scroll position", () => {
    forAll(
      (random) => {
        const rows = heights(random, int(random, 1, 120));
        const viewport = int(random, 60, 700);
        const total = rows.reduce((sum, height) => sum + height, 0);
        return { rows, scrollTop: int(random, 0, Math.max(0, total - viewport)), viewport };
      },
      ({ rows, scrollTop, viewport }) => {
        const feed = createScrollFeed(rows, viewport);
        feed.container.scrollTop = scrollTop;
        const all = feed.rows();
        const rects = all.map((row) => row.getBoundingClientRect());
        const top = all.findIndex((_, i) => (rects[i]?.bottom ?? 0) > CONTAINER_TOP);
        const bottom = all.findLastIndex((_, i) => (rects[i]?.top ?? 0) < CONTAINER_TOP + viewport);
        expect(captureScrollAnchor(feed.container)?.el).toBe(all[top]);
        expect(captureScrollAnchor(feed.container, "bottom")?.el).toBe(all[bottom]);
      },
    );
  });
});

describe("restoreScrollAnchor", () => {
  const readingMiddle = () => {
    const feed = createScrollFeed(
      Array.from({ length: 40 }, () => 60),
      300,
    );
    feed.container.scrollTop = 1000;
    const anchor = captureScrollAnchor(feed.container);
    return { anchor, before: anchor?.offset, feed };
  };

  test("a null anchor does nothing", () => {
    const { feed } = readingMiddle();
    restoreScrollAnchor(feed.container, null);
    expect(feed.container.scrollTop).toBe(1000);
  });

  test("prepending older rows keeps the reading position", () => {
    const { anchor, before, feed } = readingMiddle();
    feed.prepend([120, 80, 200]);
    restoreScrollAnchor(feed.container, anchor);
    expect(anchor ? feed.offsetOf(anchor.el) : undefined).toBe(before);
    expect(feed.container.scrollTop).toBe(1400);
  });

  test("appending newer rows leaves the scroll position alone", () => {
    const { anchor, before, feed } = readingMiddle();
    feed.append([300, 300]);
    restoreScrollAnchor(feed.container, anchor);
    expect(feed.container.scrollTop).toBe(1000);
    expect(anchor ? feed.offsetOf(anchor.el) : undefined).toBe(before);
  });

  test("an image loading above the anchor pushes the scroll down by its growth", () => {
    const { anchor, before, feed } = readingMiddle();
    feed.setHeight(2, 460);
    restoreScrollAnchor(feed.container, anchor);
    expect(anchor ? feed.offsetOf(anchor.el) : undefined).toBe(before);
    expect(feed.container.scrollTop).toBe(1400);
  });

  test("an image loading below the anchor changes nothing", () => {
    const { anchor, feed } = readingMiddle();
    feed.setHeight(30, 900);
    restoreScrollAnchor(feed.container, anchor);
    expect(feed.container.scrollTop).toBe(1000);
  });

  test("an image shrinking above the anchor pulls the scroll back up", () => {
    const { anchor, before, feed } = readingMiddle();
    feed.setHeight(0, 10);
    restoreScrollAnchor(feed.container, anchor);
    expect(anchor ? feed.offsetOf(anchor.el) : undefined).toBe(before);
    expect(feed.container.scrollTop).toBe(950);
  });

  test("resizing the viewport keeps a top anchor in place", () => {
    const { anchor, before, feed } = readingMiddle();
    feed.resize(520);
    restoreScrollAnchor(feed.container, anchor);
    expect(anchor ? feed.offsetOf(anchor.el) : undefined).toBe(before);
    feed.resize(140);
    restoreScrollAnchor(feed.container, anchor);
    expect(anchor ? feed.offsetOf(anchor.el) : undefined).toBe(before);
  });

  test("a bottom anchor survives rows arriving on both sides", () => {
    const { feed } = readingMiddle();
    const anchor = captureScrollAnchor(feed.container, "bottom");
    const before = anchor?.offset;
    feed.prepend([90, 90]);
    feed.append([500]);
    restoreScrollAnchor(feed.container, anchor);
    expect(anchor ? feed.offsetOf(anchor.el) : undefined).toBe(before);
  });
});

describe("correctScrollAfterContentChange", () => {
  const atBottom = () => {
    const feed = createScrollFeed(
      Array.from({ length: 30 }, () => 50),
      400,
    );
    scrollToBottom(feed.container);
    return { anchor: captureScrollAnchor(feed.container), feed };
  };

  test("following keeps the bottom when rows are appended", () => {
    const { anchor, feed } = atBottom();
    feed.append([70, 400]);
    correctScrollAfterContentChange(feed.container, true, anchor);
    expect(isScrolledToBottom(feed.container, 0)).toBe(true);
  });

  test("following keeps the bottom when the last image loads", () => {
    const { anchor, feed } = atBottom();
    feed.setHeight(29, 600);
    correctScrollAfterContentChange(feed.container, true, anchor);
    expect(isScrolledToBottom(feed.container, 0)).toBe(true);
  });

  test("following keeps the bottom when the viewport shrinks or grows", () => {
    const { anchor, feed } = atBottom();
    feed.resize(150);
    correctScrollAfterContentChange(feed.container, true, anchor);
    expect(isScrolledToBottom(feed.container, 0)).toBe(true);
    feed.resize(700);
    correctScrollAfterContentChange(feed.container, true, anchor);
    expect(isScrolledToBottom(feed.container, 0)).toBe(true);
  });

  test("following keeps the bottom when older rows are prepended", () => {
    const { anchor, feed } = atBottom();
    feed.prepend([300, 300, 300]);
    correctScrollAfterContentChange(feed.container, true, anchor);
    expect(isScrolledToBottom(feed.container, 0)).toBe(true);
  });

  test("not following leaves appended rows below the fold", () => {
    const { anchor, feed } = atBottom();
    const before = feed.container.scrollTop;
    feed.append([70, 400]);
    correctScrollAfterContentChange(feed.container, false, anchor);
    expect(feed.container.scrollTop).toBe(before);
    expect(isScrolledToBottom(feed.container)).toBe(false);
  });

  test("not following restores the anchor after a prepend", () => {
    const { anchor, feed } = atBottom();
    const before = anchor?.offset;
    feed.prepend([300, 300]);
    correctScrollAfterContentChange(feed.container, false, anchor);
    expect(anchor ? feed.offsetOf(anchor.el) : undefined).toBe(before);
  });

  test("not following ignores an anchor row that left the list", () => {
    const { anchor, feed } = atBottom();
    if (anchor) feed.remove(anchor.el);
    const afterRemove = feed.container.scrollTop;
    feed.prepend([300]);
    correctScrollAfterContentChange(feed.container, false, anchor);
    expect(feed.container.scrollTop).toBe(afterRemove);
  });

  test("any mix of content changes keeps the follow and anchor promises", () => {
    forAll(
      (random) => ({
        follow: random() < 0.5,
        initial: heights(random, int(random, 5, 60)),
        scrollFraction: random(),
        steps: Array.from({ length: 12 }, () => ({
          change: pick(random, changes),
          height: int(random, 8, 600),
          newRows: heights(random, int(random, 1, 6)),
          rowFraction: random(),
        })),
        viewport: int(random, 100, 600),
      }),
      ({ follow, initial, scrollFraction, steps, viewport }) => {
        const feed = createScrollFeed(initial, viewport);
        const { container } = feed;
        if (follow) scrollToBottom(container);
        else container.scrollTop = Math.floor(scrollFraction * container.scrollHeight);
        for (const step of steps) {
          const anchor = captureScrollAnchor(container);
          const before = anchor?.offset ?? 0;
          if (step.change === "prepend") feed.prepend(step.newRows);
          else if (step.change === "append") feed.append(step.newRows);
          else if (step.change === "resize") feed.resize(step.height);
          else feed.setHeight(Math.floor(step.rowFraction * feed.rows().length), step.height);
          correctScrollAfterContentChange(container, follow, anchor);
          if (follow) expect(isScrolledToBottom(container, 0)).toBe(true);
          else if (anchor && !isClamped(container)) expect(feed.offsetOf(anchor.el)).toBe(before);
        }
      },
      150,
    );
  });
});
