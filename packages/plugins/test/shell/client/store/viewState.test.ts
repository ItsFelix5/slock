import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { forAll, inRoot, int, pick } from "@slock/core/testing";
import { flush } from "solid-js";
import type { PaneContent } from "../../../../src/shell/client/api/types";
import { kinds, loadShellStore, main, side } from "./paneTestKit";

const { createShellStore } = await loadShellStore(mock.module);

type Entry = { path: string; state: unknown };
type PopListener = (event: { state: unknown }) => void;

function createFakeWindow(initialPath: string) {
  const entries: Entry[] = [{ path: initialPath, state: null }];
  let index = 0;
  const listeners = new Set<PopListener>();
  const fake = {
    addEventListener: (_type: string, listener: PopListener) => {
      listeners.add(listener);
    },
    history: {
      pushState: (state: unknown, _title: string, path: string) => {
        entries.splice(index + 1, entries.length, { path, state });
        index = entries.length - 1;
      },
      replaceState: (state: unknown, _title: string, path: string) => {
        entries[index] = { path, state };
      },
    },
    location: {
      get href() {
        return `http://slock.test${entries[index]?.path}`;
      },
    },
    removeEventListener: (_type: string, listener: PopListener) => {
      listeners.delete(listener);
    },
  };
  const travel = (to: number) => {
    if (to < 0 || to >= entries.length) return;
    index = to;
    for (const listener of listeners) listener({ state: entries[index]?.state });
  };
  const settledTravel = (to: number) => {
    flush();
    travel(to);
    flush();
  };
  return {
    back: () => settledTravel(index - 1),
    get entries() {
      flush();
      return entries;
    },
    forward: () => settledTravel(index + 1),
    index: () => {
      flush();
      return index;
    },
    install: () => Object.assign(globalThis, { window: fake }),
    listenerCount: () => listeners.size,
    path: () => {
      flush();
      return entries[index]?.path;
    },
  };
}

function flushing<Args extends unknown[], Result>(action: (...args: Args) => Result) {
  return (...args: Args): Result => {
    const result = action(...args);
    flush();
    return result;
  };
}

function boot(initialPath: string, defaultView?: PaneContent) {
  const browser = createFakeWindow(initialPath);
  browser.install();
  const root = inRoot(() =>
    createShellStore({
      defaultView: () => defaultView,
      focusedPaneId: () => null,
      paneKinds: () => kinds,
      ready: () => true,
    }),
  );
  const { dispose } = root;
  const { panes, viewState: view } = root.value;
  view.start();
  const layout = () => {
    flush();
    return panes.panes().map((pane) => pane.content);
  };
  return {
    browser,
    dispose,
    layout,
    panes: { ...panes, openInNewPane: flushing(panes.openInNewPane) },
    view: { ...view, closeTile: flushing(view.closeTile), open: flushing(view.open) },
  };
}

const realWindow = globalThis.window;

beforeEach(() => {
  Object.assign(globalThis, { window: undefined });
});

afterEach(() => {
  Object.assign(globalThis, { window: realWindow });
});

describe("initial url", () => {
  test("opens one pane per known segment and drops unknown ones", () => {
    const { layout } = boot("/m-a/zzz/s-1");
    expect(layout()).toEqual([main("a"), side("1")]);
  });

  test("normalizes the address bar without adding history", () => {
    const { browser } = boot("/m-a/zzz/s-1");
    expect(browser.path()).toBe("/m-a/s-1");
    expect(browser.entries).toHaveLength(1);
  });

  test("falls back to the default view when the url has no panes", () => {
    const { browser, layout } = boot("/", main("home"));
    expect(layout()).toEqual([main("home")]);
    expect(browser.path()).toBe("/m-home");
  });

  test("garbage paths never throw", () => {
    forAll(
      (random) =>
        `/${Array.from({ length: int(random, 0, 5) }, () => pick(random, ["m-a", "s-1", "%zz", "../../../../src/shell/client", "m-", "", "x/y", "💥"])).join("/")}`,
      (path) => {
        expect(() => boot(path, main("home")).dispose()).not.toThrow();
      },
    );
  });
});

describe("history", () => {
  test("navigating to a different thing pushes an entry", () => {
    const { browser, view } = boot("/m-a");
    view.open(main("b"));
    expect(browser.path()).toBe("/m-b");
    expect(browser.entries).toHaveLength(2);
  });

  test("changing content with the same identity replaces the entry", () => {
    const { browser, view } = boot("/m-a");
    view.open(main("a", "scroll-42"));
    expect(browser.path()).toBe("/m-a");
    expect(browser.entries).toHaveLength(1);
    expect(browser.entries[0]?.state).toEqual({ slockNav: { panes: [main("a", "scroll-42")] } });
  });

  test("back and forward restore the pane stack", () => {
    const { browser, layout, panes, view } = boot("/m-a");
    view.open(main("b"));
    panes.openInNewPane(side("1"));
    expect(layout()).toEqual([main("b"), side("1")]);
    browser.back();
    expect(layout()).toEqual([main("b")]);
    browser.back();
    expect(layout()).toEqual([main("a")]);
    browser.forward();
    browser.forward();
    expect(layout()).toEqual([main("b"), side("1")]);
    expect(browser.path()).toBe("/m-b/s-1");
  });

  test("going back does not push new entries", () => {
    const { browser, view } = boot("/m-a");
    view.open(main("b"));
    view.open(main("c"));
    browser.back();
    browser.back();
    expect(browser.entries.map((entry) => entry.path)).toEqual(["/m-a", "/m-b", "/m-c"]);
    expect(browser.index()).toBe(0);
  });

  test("a pop without slock state is ignored", () => {
    const { browser, layout } = boot("/m-a");
    browser.entries.push({ path: "/other", state: null });
    browser.forward();
    expect(layout()).toEqual([main("a")]);
  });

  test("pop keeps ids of panes that survive so view state stays mounted", () => {
    const { browser, panes, view } = boot("/m-a");
    view.open(main("b"));
    panes.openInNewPane(side("1"));
    const mainId = panes.panes()[0]?.id;
    browser.back();
    expect(panes.panes()[0]?.id).toBe(mainId ?? "");
  });
});

describe("invariants", () => {
  test("the address bar always mirrors the panes", () => {
    forAll(
      (random) =>
        Array.from({ length: int(random, 1, 16) }, () => ({
          id: pick(random, ["a", "b", "c", "d"]),
          op: pick(random, ["open", "split", "side", "back", "forward", "close"] as const),
        })),
      (steps) => {
        const { browser, dispose, panes, view } = boot("/m-a", main("a"));
        for (const step of steps) {
          if (step.op === "open") view.open(main(step.id));
          else if (step.op === "split") panes.openInNewPane(main(step.id));
          else if (step.op === "side") panes.openInNewPane(side(step.id));
          else if (step.op === "back") browser.back();
          else if (step.op === "forward") browser.forward();
          else view.closeTile(panes.panes().at(-1)?.id ?? "");
          const segments = panes
            .panes()
            .flatMap((pane) =>
              pane.content?.kind === "mainTest"
                ? [`m-${pane.content.id}`]
                : pane.content?.kind === "sideTest"
                  ? [`s-${pane.content.id}`]
                  : [],
            );
          expect(browser.path()).toBe(`/${segments.join("/")}`);
        }
        dispose();
      },
      100,
    );
  });
});

describe("lifecycle", () => {
  test("disposing removes the popstate listener", () => {
    const { browser, dispose } = boot("/m-a");
    expect(browser.listenerCount()).toBe(1);
    dispose();
    expect(browser.listenerCount()).toBe(0);
  });

  test("a disposed store stops writing history", () => {
    const { browser, dispose, view } = boot("/m-a");
    dispose();
    view.open(main("b"));
    expect(browser.entries).toHaveLength(1);
  });
});
