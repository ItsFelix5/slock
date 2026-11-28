import { afterEach, describe, expect, test } from "bun:test";
import { defined } from "@slock/core";
import { createRoot, flush } from "solid-js";
import {
  createFeedScroll,
  type LandTarget,
} from "../../../../../../packages/plugins/src/messages/client/api/pane/scroll/feedScroll";
import { forAll, int, pick, type Random } from "../../../../../support/core";
import { stamp } from "../../../../../support/slack";
import { CONTAINER_TOP, createScrollFeed } from "./scrollFeedFixture";

const changes = ["prepend", "append", "grow", "shrink", "resize"] as const;

const heights = (random: Random, count: number) =>
  Array.from({ length: count }, () => int(random, 8, 200));

const uniform = (count: number, height: number) => Array.from({ length: count }, () => height);

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.innerHTML = "";
});

function mount(rows: number[], viewport: number, isLive = () => true) {
  const fixture = createScrollFeed(rows, viewport);
  const feed = createRoot((dispose) => {
    disposers.push(dispose);
    const controller = createFeedScroll({ isLive });
    controller.attach(fixture.container);
    return controller;
  });
  return {
    feed,
    fixture,
    layout(change: () => void) {
      change();
      feed.settle();
      flush();
    },
    async land(target: LandTarget) {
      feed.land(target);
      await Promise.resolve();
      flush();
    },
    reset() {
      feed.reset();
      flush();
    },
    settle() {
      feed.settle();
      flush();
    },
    maxTop: () => fixture.container.scrollHeight - fixture.container.clientHeight,
    userScroll(top: number) {
      fixture.container.scrollTop = top;
      fixture.container.dispatchEvent(new Event("scroll"));
      fixture.container.dispatchEvent(new Event("scrollend"));
      flush();
    },
  };
}

type View = ReturnType<typeof mount>;

function applyChange(view: View, kind: (typeof changes)[number], random: Random) {
  const { fixture } = view;
  view.layout(() => {
    if (kind === "prepend") fixture.prepend(heights(random, int(random, 1, 6)));
    else if (kind === "append") fixture.append(heights(random, int(random, 1, 6)));
    else if (kind === "resize") fixture.resize(int(random, 150, 700));
    else {
      const index = int(random, 0, fixture.rows().length - 1);
      const current = defined(fixture.rows()[index]).getBoundingClientRect().height;
      const next = kind === "grow" ? current + int(random, 1, 120) : current - int(random, 0, 60);
      fixture.setHeight(index, Math.max(8, next));
    }
  });
}

function topRow(view: View) {
  const group = defined(
    view.fixture.rows().find((row) => row.getBoundingClientRect().bottom > CONTAINER_TOP),
  );
  return { group, offset: view.fixture.offsetOf(group) };
}

describe("following the bottom", () => {
  test("stays at the bottom through any layout change", () => {
    forAll(
      (random) => ({
        random,
        rows: heights(random, int(random, 5, 40)),
        sequence: Array.from({ length: int(random, 1, 12) }, () => pick(random, changes)),
        viewport: int(random, 150, 700),
      }),
      ({ random, rows, sequence, viewport }) => {
        const view = mount(rows, viewport);
        view.settle();
        for (const kind of sequence) {
          applyChange(view, kind, random);
          expect(view.fixture.container.scrollTop).toBe(Math.max(0, view.maxTop()));
        }
      },
      80,
    );
  });

  test("a user scroll away stops following", () => {
    const view = mount(uniform(30, 60), 300);
    view.settle();
    view.userScroll(view.maxTop() - 400);
    const before = view.fixture.container.scrollTop;
    view.layout(() => view.fixture.append([100, 100]));
    expect(view.fixture.container.scrollTop).toBe(before);
    expect(view.feed.atBottom()).toBe(false);
  });

  test("scrolling back to the bottom resumes following", () => {
    const view = mount(uniform(30, 60), 300);
    view.settle();
    view.userScroll(100);
    view.userScroll(view.maxTop());
    view.layout(() => view.fixture.append([100]));
    expect(view.fixture.container.scrollTop).toBe(view.maxTop());
  });

  test("scrolling to the end of a partial feed does not chase new pages", () => {
    const view = mount(uniform(5, 100), 200, () => false);
    view.settle();
    view.feed.scrollEdge("end");
    const before = view.maxTop();
    view.layout(() => view.fixture.append([300]));
    expect(view.fixture.container.scrollTop).toBe(before);
  });

  test("a feed that is not live never follows", async () => {
    const view = mount(uniform(5, 100), 200, () => false);
    await view.land({ align: "start", at: "row", ts: stamp("0") });
    view.layout(() => view.fixture.append([300]));
    expect(view.fixture.container.scrollTop).toBe(0);
  });
});

describe("holding position", () => {
  test("the top row keeps its offset through changes above it", () => {
    forAll(
      (random) => ({ random, scrollTo: int(random, 100, 1800) }),
      ({ random, scrollTo }) => {
        const view = mount(uniform(40, 60), 300);
        view.settle();
        view.userScroll(scrollTo);
        const { group, offset } = topRow(view);
        view.layout(() => view.fixture.prepend(heights(random, int(random, 1, 5))));
        expect(view.fixture.offsetOf(group)).toBeCloseTo(offset, 0);
        view.layout(() => view.fixture.setHeight(0, int(random, 8, 400)));
        expect(view.fixture.offsetOf(group)).toBeCloseTo(offset, 0);
      },
      80,
    );
  });

  test("a prepend mid-gesture never moves the rows on screen", () => {
    const view = mount(uniform(40, 60), 300);
    view.settle();
    view.fixture.container.scrollTop = 500;
    view.fixture.container.dispatchEvent(new Event("scroll"));
    const { group, offset } = topRow(view);
    view.layout(() => view.fixture.prepend(uniform(30, 60)));
    expect(view.fixture.offsetOf(group)).toBeCloseTo(offset, 0);
  });

  test("a scroll and a prepend in the same frame keep the scrolled position", () => {
    const view = mount(uniform(40, 60), 300);
    view.settle();
    view.fixture.container.scrollTop = 500;
    view.fixture.container.dispatchEvent(new Event("scroll"));
    view.fixture.container.scrollTop = 560;
    const { group, offset } = topRow(view);
    view.fixture.prepend(uniform(30, 60));
    view.settle();
    expect(view.fixture.offsetOf(group)).toBeCloseTo(offset, 0);
  });

  test("the scroll event from our own landing write keeps following the bottom", async () => {
    const view = mount(uniform(40, 60), 300);
    await view.land({ at: "bottom" });
    view.fixture.container.dispatchEvent(new Event("scroll"));
    view.layout(() => view.fixture.prepend(uniform(20, 60)));
    expect(view.fixture.container.scrollTop).toBe(view.maxTop());
  });

  test("resizing the pane keeps the top row in place", () => {
    const view = mount(uniform(40, 60), 300);
    view.settle();
    view.userScroll(500);
    const { group, offset } = topRow(view);
    view.layout(() => view.fixture.resize(500));
    expect(view.fixture.offsetOf(group)).toBeCloseTo(offset, 0);
  });
});

describe("plain scrolling", () => {
  test("never writes scrollTop back while nothing shifts", () => {
    const view = mount(uniform(80, 61.3), 300);
    view.settle();
    for (let top = 40; top < 3000; top += 37.7) {
      view.fixture.container.scrollTop = top;
      const writes = view.fixture.writes();
      view.fixture.container.dispatchEvent(new Event("scroll"));
      expect(view.fixture.writes()).toBe(writes);
    }
  });

  test("a nudge within the bottom slack is not snapped back", () => {
    const view = mount(uniform(30, 60), 300);
    view.settle();
    for (const distance of [1, 2]) {
      view.userScroll(view.maxTop() - distance);
      expect(view.fixture.container.scrollTop).toBe(view.maxTop() - distance);
    }
    view.layout(() => view.fixture.append([100]));
    expect(view.fixture.container.scrollTop).toBe(view.maxTop());
  });
});

describe("landing", () => {
  test("a row target stays pinned while rows above it change", async () => {
    const view = mount(uniform(40, 60), 300);
    await view.land({ align: "start", at: "row", ts: stamp("20") });
    const target = defined(view.fixture.rows()[20]);
    expect(view.fixture.offsetOf(target)).toBe(0);
    view.layout(() => view.fixture.setHeight(3, 500));
    expect(view.fixture.offsetOf(target)).toBe(0);
    view.layout(() => view.fixture.prepend([200]));
    expect(view.fixture.offsetOf(target)).toBe(0);
  });

  test("a user scroll releases the pin", async () => {
    const view = mount(uniform(40, 60), 300);
    await view.land({ align: "start", at: "row", ts: stamp("20") });
    view.userScroll(view.fixture.container.scrollTop + 100);
    const target = defined(view.fixture.rows()[20]);
    const offset = view.fixture.offsetOf(target);
    view.layout(() => view.fixture.setHeight(30, 500));
    expect(view.fixture.offsetOf(target)).toBe(offset);
  });

  test("a target row that mounts after the landing is reached once it renders", async () => {
    const view = mount(uniform(40, 60), 300);
    await view.land({ align: "start", at: "row", ts: stamp("40") });
    expect(view.feed.ready()).toBe(true);
    view.layout(() => view.fixture.prepend([60]));
    const [row] = view.fixture.rows();
    expect(view.fixture.offsetOf(defined(row))).toBe(0);
  });

  test("an offset target restores the remembered position", async () => {
    const view = mount(uniform(40, 60), 300);
    await view.land({ at: "offset", offset: 25, ts: stamp("10") });
    expect(view.fixture.offsetOf(defined(view.fixture.rows()[10]))).toBe(25);
  });

  test("reset hides the list until the next landing", async () => {
    const view = mount([100, 100, 100], 200);
    await view.land({ at: "bottom" });
    expect(view.feed.ready()).toBe(true);
    view.reset();
    expect(view.feed.ready()).toBe(false);
  });
});

describe("hidden panes", () => {
  test("the position survives the browser resetting scrollTop while hidden", () => {
    const view = mount(uniform(40, 60), 300);
    view.settle();
    view.userScroll(500);
    const { group, offset } = topRow(view);
    view.layout(() => view.fixture.resize(0));
    view.fixture.container.scrollTop = 0;
    view.layout(() => view.fixture.resize(300));
    expect(view.fixture.offsetOf(group)).toBeCloseTo(offset, 0);
  });
});
