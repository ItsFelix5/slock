import { beforeEach, describe, expect, mock, test } from "bun:test";
import { forAll, int, pick } from "@slock/core/testing";
import { createRoot } from "solid-js";
import {
  focusCalls,
  follow,
  kinds,
  loadPanes,
  main,
  setFocusedId,
  side,
} from "../../../../src/shell/client/store/paneTestKit";

const { createPanesSlice } = await loadPanes(mock.module);

function setup() {
  let dispose = () => {};
  const slice = createRoot((d) => {
    dispose = d;
    return createPanesSlice(() => kinds);
  });
  const layout = () => slice.panes().map((pane) => pane.content);
  const total = () => slice.panes().reduce((sum, pane) => sum + pane.size, 0);
  return { dispose, layout, slice, total };
}

beforeEach(() => {
  focusCalls.length = 0;
  setFocusedId(null);
});

describe("openInNewPane", () => {
  test("appends a non singleton pane after the focused one", () => {
    const { layout, slice } = setup();
    slice.setAllPanes([main("a"), main("b")]);
    slice.activatePane(slice.panes()[0]?.id ?? "");
    slice.openInNewPane(main("c"));
    expect(layout()).toEqual([main("a"), main("c"), main("b")]);
  });

  test("reuses a singleton pane that is already right after focus", () => {
    const { layout, slice } = setup();
    slice.setAllPanes([main("a"), side("1")]);
    slice.activatePane(slice.panes()[0]?.id ?? "");
    const id = slice.openInNewPane(side("2"));
    expect(layout()).toEqual([main("a"), side("2")]);
    expect(id).toBe(slice.panes()[1]?.id ?? "");
  });

  test("reuses a plain singleton wherever it sits", () => {
    const { layout, slice } = setup();
    slice.setAllPanes([side("1"), main("a"), main("b")]);
    slice.activatePane(slice.panes()[2]?.id ?? "");
    slice.openInNewPane(side("2"));
    expect(layout()).toEqual([side("2"), main("a"), main("b")]);
  });

  test("moves a followsFocus singleton next to the focused pane with its own size", () => {
    const { layout, slice } = setup();
    slice.setAllPanes([follow("1"), main("a"), main("b")]);
    slice.activatePane(slice.panes()[1]?.id ?? "");
    const id = slice.openInNewPane(follow("2"));
    expect(layout()).toEqual([main("a"), follow("2"), main("b")]);
    expect(slice.panes()[1]?.id).toBe(id);
    expect(slice.panes()[1]?.size).toBeCloseTo(0.4);
  });

  test("a focused followsFocus singleton is replaced in place", () => {
    const { layout, slice } = setup();
    slice.setAllPanes([main("a"), follow("1"), main("b")]);
    slice.activatePane(slice.panes()[1]?.id ?? "");
    slice.openInNewPane(follow("2"));
    expect(layout()).toEqual([main("a"), follow("2"), main("b")]);
  });

  test("sizes always sum to 1 and ids stay unique", () => {
    forAll(
      (random) =>
        Array.from({ length: int(random, 1, 14) }, () => ({
          at: int(random, 0, 7),
          content: pick(random, [main("x"), side("s"), follow("f")]),
          op: pick(random, ["open", "open", "close"] as const),
        })),
      (steps) => {
        const { layout, slice, total } = setup();
        for (const step of steps) {
          const panes = slice.panes();
          const target = panes[step.at % panes.length];
          if (target) slice.activatePane(target.id);
          if (step.op === "open") slice.openInNewPane(step.content);
          else if (target) slice.closePane(target.id);
          const ids = slice.panes().map((pane) => pane.id);
          expect(new Set(ids).size).toBe(ids.length);
          expect(total()).toBeCloseTo(1, 6);
          expect(layout().length).toBeGreaterThan(0);
        }
      },
    );
  });
});

describe("closePane", () => {
  test("never closes the last pane", () => {
    const { layout, slice } = setup();
    slice.closePane(slice.panes()[0]?.id ?? "");
    expect(layout()).toEqual([null]);
  });

  test("hands focus to the pane that takes the closed slot", async () => {
    const { slice } = setup();
    slice.setAllPanes([main("a"), main("b"), main("c")]);
    const [first, second, third] = slice.panes();
    slice.activatePane(second?.id ?? "");
    slice.closePane(second?.id ?? "");
    expect(slice.activePaneId()).toBe(third?.id ?? "");
    slice.closePane(third?.id ?? "");
    expect(slice.activePaneId()).toBe(first?.id ?? "");
    await Promise.resolve();
    expect(focusCalls.at(-1)).toBe(first?.id ?? "");
  });

  test("closing an unfocused pane keeps the active pane", () => {
    const { slice } = setup();
    slice.setAllPanes([main("a"), main("b"), main("c")]);
    const [first, second, third] = slice.panes();
    slice.activatePane(third?.id ?? "");
    slice.closePane(first?.id ?? "");
    expect(slice.activePaneId()).toBe(third?.id ?? "");
    expect(slice.panes().map((pane) => pane.id)).toEqual([second?.id ?? "", third?.id ?? ""]);
  });
});

describe("primary pane lookup", () => {
  test("navigateFocusedPane targets the nearest primary pane to the left first", () => {
    const { layout, slice } = setup();
    slice.setAllPanes([main("a"), side("s"), main("b")]);
    slice.activatePane(slice.panes()[1]?.id ?? "");
    slice.navigateFocusedPane(main("z"));
    expect(layout()).toEqual([main("z"), side("s"), main("b")]);
  });

  test("falls back to a primary pane on the right, then to the first pane", () => {
    const { layout, slice } = setup();
    slice.setAllPanes([side("s"), main("b")]);
    slice.activatePane(slice.panes()[0]?.id ?? "");
    expect(slice.focusedPrimaryContent()).toEqual(main("b"));
    slice.setAllPanes([side("s"), side("t")]);
    slice.navigateFocusedPane(main("z"));
    expect(layout()).toEqual([main("z"), side("t")]);
  });
});

describe("setAllPanes", () => {
  test("keeps pane ids by position and splits size evenly", () => {
    const { slice, total } = setup();
    slice.setAllPanes([main("a"), main("b")]);
    const before = slice.panes().map((pane) => pane.id);
    slice.setAllPanes([main("c"), main("d"), main("e")]);
    expect(
      slice
        .panes()
        .map((pane) => pane.id)
        .slice(0, 2),
    ).toEqual(before);
    expect(slice.panes().map((pane) => pane.size)).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(total()).toBeCloseTo(1);
  });

  test("an empty list leaves one empty pane", () => {
    const { layout, slice } = setup();
    slice.setAllPanes([main("a"), main("b")]);
    slice.setAllPanes([]);
    expect(layout()).toEqual([null]);
  });
});

describe("insertContentPane", () => {
  test("inserts after the given pane, or first for null", () => {
    const { layout, slice } = setup();
    slice.setAllPanes([main("a"), main("b")]);
    slice.insertContentPane(side("s"), slice.panes()[0]?.id ?? "");
    slice.insertContentPane(follow("f"), null);
    expect(layout()).toEqual([follow("f"), main("a"), side("s"), main("b")]);
  });
});
