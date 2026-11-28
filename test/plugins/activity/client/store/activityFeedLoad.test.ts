import { describe, expect, spyOn, test } from "bun:test";
import { flush } from "solid-js";
import { stamp, uid } from "../../../../support/slack";
import { entry, harness, wait } from "./feedLoadHarness";

describe("first page", () => {
  test("loads newest first and drops own thread replies", async () => {
    using h = harness({
      ":": {
        entries: [
          entry("a", 100),
          entry("c", 300),
          entry("b", 200, { kind: "thread_reply", userId: uid("U1") }),
        ],
      },
    });
    await h.loaded();
    expect(h.ids()).toEqual(["c", "a"]);
    expect(h.load.activityLoaded()).toBe(true);
  });

  test("waits until the host is ready before fetching", async () => {
    using h = harness({ ":": { entries: [entry("a", 100)] } }, { ready: false });
    await wait(10);
    expect(h.fetches).toHaveLength(0);
    expect(h.load.activityLoaded()).toBe(false);
    h.setReady(true);
    flush();
    await h.loaded();
    expect(h.ids()).toEqual(["a"]);
  });

  test("a failed load is reported, stays unloaded and can be retried", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    try {
      using h = harness({ ":": { entries: [entry("a", 100)] } }, { ready: false });
      h.failOnce(undefined, "");
      h.setReady(true);
      flush();
      await wait(10);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(h.load.activityLoaded()).toBe(false);
      expect(h.ids()).toEqual([]);
      await h.load.retryActivityLoad();
      expect(h.load.activityLoaded()).toBe(true);
      expect(h.ids()).toEqual(["a"]);
    } finally {
      consoleError.mockRestore();
    }
  });

  test("duplicate ids and repeated reactions are pushed once", async () => {
    const reaction = (id: string, time: number) =>
      entry(id, time, {
        kind: "reaction",
        reactionName: "tada",
        ts: stamp("5.5"),
        userId: uid("U3"),
      });
    using h = harness({
      ":": {
        entries: [entry("a", 100), entry("a", 100), reaction("r1", 200), reaction("r2", 300)],
      },
    });
    await h.loaded();
    expect(h.ids().sort()).toEqual(["a", "r1"]);
  });

  test("equal times keep arrival order", async () => {
    using h = harness({ ":": { entries: [entry("x", 100), entry("y", 100), entry("z", 100)] } });
    await h.loaded();
    expect(h.ids()).toEqual(["x", "y", "z"]);
  });
});

describe("pagination", () => {
  const twoPages = () => ({
    ":": { entries: [entry("n3", 300), entry("n2", 200)], nextCursor: "p2" },
    ":p2": { entries: [entry("n1", 100)] },
  });

  test("appends older pages in order and stops without a cursor", async () => {
    using h = harness(twoPages());
    await h.loaded();
    expect(h.load.activityHasMore()).toBe(true);
    await h.more();
    expect(h.ids()).toEqual(["n3", "n2", "n1"]);
    expect(h.fetches.at(-1)).toEqual({ cursor: "p2", types: undefined });
    expect(h.load.activityHasMore()).toBe(false);
    h.load.loadMoreActivity();
    flush();
    await wait(5);
    expect(h.fetches).toHaveLength(2);
  });

  test("an empty older page ends pagination even when it carries a cursor", async () => {
    using h = harness({
      ":": { entries: [entry("a", 200)], nextCursor: "p2" },
      ":p2": { entries: [], nextCursor: "p3" },
    });
    await h.loaded();
    await h.more();
    expect(h.load.activityHasMore()).toBe(false);
  });

  test("an empty newest page keeps the cursor it was given", async () => {
    using h = harness({ ":": { entries: [], nextCursor: "p2" } });
    await h.loaded();
    expect(h.load.activityHasMore()).toBe(true);
  });

  test("loading more before the first page arrives is ignored", async () => {
    using h = harness(twoPages(), { ready: false });
    h.load.loadMoreActivity();
    flush();
    await wait(5);
    expect(h.fetches).toHaveLength(0);
  });

  test("a failed page keeps the items, rejects, and retries the same cursor", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    try {
      using h = harness(twoPages());
      await h.loaded();
      h.failOnce(undefined, "p2");
      h.load.loadMoreActivity();
      flush();
      await wait(10);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(h.ids()).toEqual(["n3", "n2"]);
      expect(h.load.activityHasMore()).toBe(true);
      await h.more();
      expect(h.ids()).toEqual(["n3", "n2", "n1"]);
      expect(h.fetches.filter((fetch) => fetch.cursor === "p2")).toHaveLength(2);
    } finally {
      consoleError.mockRestore();
    }
  });

  test("scoped feeds keep their own cursors and exhaustion", async () => {
    using h = harness({
      ":": { entries: [entry("a", 100)], nextCursor: "main" },
      "keyword:": { entries: [entry("s1", 90)], nextCursor: "k2" },
      "keyword:k2": { entries: [entry("s2", 80)] },
    });
    await h.loaded();
    await h.more("keyword");
    expect(h.fetches.at(-1)).toEqual({ cursor: undefined, types: "keyword" });
    expect(h.load.activityHasMore("keyword")).toBe(true);
    await h.more("keyword");
    expect(h.fetches.at(-1)).toEqual({ cursor: "k2", types: "keyword" });
    expect(h.load.activityHasMore("keyword")).toBe(false);
    expect(h.load.activityHasMore()).toBe(true);
    expect(h.ids()).toEqual(["a", "s1", "s2"]);
  });

  test("unread-only is its own scope", async () => {
    using h = harness({
      ":": { entries: [entry("a", 100)], nextCursor: "main" },
      ":|unread": { entries: [entry("u", 50)] },
    });
    await h.loaded();
    await h.more(undefined, true);
    expect(h.load.activityHasMore(undefined, true)).toBe(false);
    expect(h.load.activityHasMore()).toBe(true);
  });
});
