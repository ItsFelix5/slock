import { afterEach, describe, expect, test } from "bun:test";
import { stamp } from "@slock/slack/testing";
import { flush, refresh } from "solid-js";
import { disposeHarnesses, entry, harness, wait } from "./feedLoadHarness";

afterEach(disposeHarnesses);

describe("refresh and races", () => {
  test("a live refresh updates an item that got newer activity", async () => {
    const thread = (time: number, unreadCount: number) =>
      entry("t", time, { kind: "thread_reply", threadTs: stamp("9.9"), unreadCount });
    const h = harness({ ":": { entries: [thread(100, 1)] } });
    await h.loaded();
    h.pages[":"] = { entries: [thread(500, 4), entry("n", 300)] };
    await refresh(h.load.activityFeed);
    expect(h.items.find((item) => item.id === "t")?.unreadCount).toBe(4);
    expect(h.ids()).toEqual(["t", "n"]);
  });

  test("a refresh keeps scoped pagination state", async () => {
    const h = harness({
      ":": { entries: [entry("a", 100)], nextCursor: "main" },
      "keyword:": { entries: [entry("s", 50)] },
    });
    await h.loaded();
    await h.more("keyword");
    await refresh(h.load.activityFeed);
    expect(h.load.activityHasMore("keyword")).toBe(false);
  });

  test("a refresh while loading more is skipped and never duplicates items", async () => {
    const h = harness({
      ":": { entries: [entry("n3", 300), entry("n2", 200)], nextCursor: "p2" },
      ":p2": { entries: [entry("n1", 100)] },
    });
    await h.loaded();
    h.setDelay(10);
    const more = h.more();
    h.load.requestActivityRefresh();
    await more;
    await wait(300);
    expect(h.ids()).toEqual(["n3", "n2", "n1"]);
    expect(h.fetches.filter((fetch) => fetch.cursor === "p2")).toHaveLength(1);
  });

  test("loading more while a refresh is in flight is ignored", async () => {
    const h = harness({
      ":": { entries: [entry("a", 100)], nextCursor: "p2" },
      ":p2": { entries: [entry("b", 50)] },
    });
    await h.loaded();
    h.setDelay(10);
    const refreshing = refresh(h.load.activityFeed);
    await wait(2);
    h.load.loadMoreActivity();
    flush();
    await refreshing;
    expect(h.fetches.filter((fetch) => fetch.cursor === "p2")).toHaveLength(0);
  });

  test("an update refreshes the feed without the view open", async () => {
    const h = harness({ ":": { entries: [entry("a", 100)] } });
    await h.loaded();
    h.load.requestActivityRefresh();
    await wait(300);
    expect(h.fetches).toHaveLength(2);
  });

  test("a pending live refresh is dropped when the store is disposed", async () => {
    const h = harness({ ":": { entries: [entry("a", 100)] } });
    await h.loaded();
    h.load.requestActivityRefresh();
    disposeHarnesses();
    await wait(300);
    expect(h.fetches).toHaveLength(1);
  });
});
