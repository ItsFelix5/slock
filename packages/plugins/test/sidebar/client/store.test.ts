import { describe, expect, test } from "bun:test";
import { forAll, int } from "@slock/core/testing";
import { createRoot, createSignal, flush } from "solid-js";
import type { CycleTarget } from "../../../src/sidebar/client/api";

import { createSidebarStore } from "../../../src/sidebar/client/store";

const focused: string[] = [];

function targets(count: number, activeIndex: number, opened: string[], tag = "t") {
  return Array.from(
    { length: count },
    (_, i): CycleTarget => ({
      active: i === activeIndex,
      open: (split) => opened.push(`${tag}${i}${split ? "+split" : ""}`),
    }),
  );
}

function setup(isHidden: (id: string) => boolean = () => false) {
  let dispose = () => {};
  const store = createRoot((d) => {
    dispose = d;
    return createSidebarStore(isHidden, () => focused.push("sidebar"));
  });
  return { dispose, store };
}

function provide(store: ReturnType<typeof setup>["store"], order: number, list: CycleTarget[]) {
  let dispose = () => {};
  createRoot((d) => {
    dispose = d;
    store.provideCycle(order, () => list);
  });
  flush();
  return dispose;
}

describe("stepCycle", () => {
  test("moves to the next and previous target", () => {
    const opened: string[] = [];
    const { store } = setup();
    provide(store, 0, targets(4, 1, opened));
    store.stepCycle(1, false);
    store.stepCycle(-1, false);
    expect(opened).toEqual(["t2", "t0"]);
  });

  test("wraps around at both ends", () => {
    const opened: string[] = [];
    const { store } = setup();
    provide(store, 0, targets(3, 2, opened));
    store.stepCycle(1, false);
    const second = setup();
    provide(second.store, 0, targets(3, 0, opened, "u"));
    second.store.stepCycle(-1, false);
    expect(opened).toEqual(["t0", "u2"]);
  });

  test("counts the first target as current when none is active", () => {
    const opened: string[] = [];
    const { store } = setup();
    provide(store, 0, targets(3, -1, opened));
    store.stepCycle(1, false);
    store.stepCycle(-1, false);
    expect(opened).toEqual(["t1", "t2"]);
  });

  test("a single target opens itself in both directions", () => {
    const opened: string[] = [];
    const { store } = setup();
    provide(store, 0, targets(1, -1, opened));
    store.stepCycle(1, false);
    store.stepCycle(-1, false);
    expect(opened).toEqual(["t0", "t0"]);
  });

  test("follows the active target when the list changes under it", () => {
    const opened: string[] = [];
    const { store } = setup();
    const [list, setList] = createSignal(targets(4, 2, opened));
    createRoot(() => store.provideCycle(0, list));
    flush();
    store.stepCycle(1, false);
    setList(targets(2, -1, opened, "n"));
    flush();
    store.stepCycle(1, false);
    setList(targets(5, 4, opened, "m"));
    flush();
    store.stepCycle(1, false);
    expect(opened).toEqual(["t3", "n1", "m0"]);
  });

  test("passes the split flag", () => {
    const opened: string[] = [];
    const { store } = setup();
    provide(store, 0, targets(2, 0, opened));
    store.stepCycle(1, true);
    expect(opened).toEqual(["t1+split"]);
  });

  test("does nothing without targets", () => {
    const { store } = setup();
    expect(() => store.stepCycle(1, false)).not.toThrow();
    expect(store.cycleTargets()).toEqual([]);
  });

  test("always opens exactly one in-range target", () => {
    forAll(
      (random) => ({
        active: int(random, -1, 8),
        count: int(random, 1, 9),
        direction: int(random, 0, 1) === 0 ? (-1 as const) : (1 as const),
      }),
      ({ active, count, direction }) => {
        const opened: string[] = [];
        const { store } = setup();
        provide(store, 0, targets(count, active < count ? active : -1, opened));
        store.stepCycle(direction, false);
        expect(opened).toHaveLength(1);
        const index = Number(opened[0]?.slice(1));
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(count);
      },
    );
  });
});

describe("sources", () => {
  test("targets are ordered by source order, ties by registration", () => {
    const opened: string[] = [];
    const { store } = setup();
    provide(store, 5, targets(1, -1, opened, "late"));
    provide(store, 1, targets(1, -1, opened, "early"));
    provide(store, 1, targets(1, -1, opened, "early2"));
    for (const target of store.cycleTargets()) target.open(false);
    expect(opened).toEqual(["early0", "early20", "late0"]);
  });

  test("disposing a source removes its targets", () => {
    const opened: string[] = [];
    const { store } = setup();
    const removeFirst = provide(store, 0, targets(2, -1, opened, "a"));
    provide(store, 1, targets(1, -1, opened, "b"));
    expect(store.cycleTargets()).toHaveLength(3);
    removeFirst();
    flush();
    expect(store.cycleTargets()).toHaveLength(1);
  });
});

describe("setNavView", () => {
  test("focuses the sidebar for visible views", async () => {
    focused.length = 0;
    const { store } = setup();
    store.setNavView("search");
    flush();
    expect(store.nav()).toBe("search");
    await Promise.resolve();
    expect(focused).toEqual(["sidebar"]);
  });

  test("hidden views switch without stealing focus", async () => {
    focused.length = 0;
    const { store } = setup((id) => id === "ghost");
    store.setNavView("ghost");
    flush();
    expect(store.nav()).toBe("ghost");
    await Promise.resolve();
    expect(focused).toEqual([]);
  });
});
