import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { systemEnv } from "@slock/core";
import { inRoot } from "@slock/core/testing";
import { ch, stamp, uid } from "@slock/slack/testing";
import type { FeedEntry, Message, User } from "@slock/types";
import { createSignal, flush, refresh, until } from "solid-js";
import { createActivityFeedLoad } from "../../../../src/activity/client/store/activityFeedLoad";
import { createActivityItems } from "../../../../src/activity/client/store/activityItems";

const me: User = { avatarColor: "", id: uid("U1"), name: "me" };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function entry(id: string, time: number, patch: Partial<FeedEntry> = {}): FeedEntry {
  return {
    channelId: ch("C1"),
    id,
    kind: "mention",
    text: id,
    time,
    ts: stamp(`${time}.0`),
    unread: true,
    userId: uid("U2"),
    ...patch,
  };
}

type Page = { entries: FeedEntry[]; nextCursor?: string };

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});

function harness(pages: Record<string, Page>, options: { ready?: boolean } = {}) {
  const fetches: { cursor?: string; types?: string; unreadOnly?: boolean }[] = [];
  const reactionFlashes: string[] = [];
  const [ready, setReady] = createSignal(options.ready ?? true);
  const failures: string[] = [];
  let delayMs = 0;
  const itemsRoot = inRoot(createActivityItems);
  const items = itemsRoot.value;
  const root = inRoot(() =>
    createActivityFeedLoad({
      backfillMissingReadCursors: async () => {},
      currentUser: () => me,
      env: systemEnv,
      fetchActivityFeedEntries: async (_limit, cursor, types, unreadOnly) => {
        fetches.push({ cursor, types, ...(unreadOnly ? { unreadOnly } : {}) });
        if (delayMs) await wait(delayMs);
        const key = `${types ?? ""}${unreadOnly ? "|unread" : ""}:${cursor ?? ""}`;
        if (failures.includes(key)) {
          failures.splice(failures.indexOf(key), 1);
          throw new Error("down");
        }
        return pages[key] ?? { entries: [] };
      },
      fetchHistoryAround: async () => ({ messages: [] }),
      fetchMessagesByIds: async () => new Map<string, Message>(),
      items,
      onReactionPushed: (name) => reactionFlashes.push(name),
      ready,
      resolveActivityEntry: (raw) => ({ ...raw, text: raw.text ?? "" }),
    }),
  );
  disposers.push(root.dispose, itemsRoot.dispose);
  const load = root.value;
  let requests = 0;
  return {
    failOnce: (types: string | undefined, cursor: string) => failures.push(`${types ?? ""}:${cursor}`),
    fetches,
    ids: () => items.list.map((item) => item.id),
    items: items.list,
    load,
    loaded: () => until(load.activityFeed),
    more: async (types?: string, unreadOnly?: boolean) => {
      const before = load.activityMore()?.id ?? 0;
      load.loadMoreActivity(types, unreadOnly);
      flush();
      requests++;
      if (load.activityMore()?.id === before) return;
      await until(() => load.activityMore()?.id !== before);
    },
    pages,
    reactionFlashes,
    requests: () => requests,
    setDelay: (ms: number) => {
      delayMs = ms;
    },
    setReady,
  };
}

describe("first page", () => {
  test("loads newest first and drops own thread replies", async () => {
    const h = harness({
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
    const h = harness({ ":": { entries: [entry("a", 100)] } }, { ready: false });
    await wait(10);
    expect(h.fetches).toHaveLength(0);
    expect(h.load.activityLoaded()).toBe(false);
    h.setReady(true);
    flush();
    await h.loaded();
    expect(h.ids()).toEqual(["a"]);
  });

  test("a failed load rejects, stays unloaded and can be retried", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    try {
      const h = harness({ ":": { entries: [entry("a", 100)] } }, { ready: false });
      h.failOnce(undefined, "");
      h.setReady(true);
      flush();
      await expect(h.load.retryActivityLoad()).rejects.toThrow("down");
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
      entry(id, time, { kind: "reaction", reactionName: "tada", ts: stamp("5.5"), userId: uid("U3") });
    const h = harness({
      ":": { entries: [entry("a", 100), entry("a", 100), reaction("r1", 200), reaction("r2", 300)] },
    });
    await h.loaded();
    expect(h.ids().sort()).toEqual(["a", "r1"]);
  });

  test("equal times keep arrival order", async () => {
    const h = harness({ ":": { entries: [entry("x", 100), entry("y", 100), entry("z", 100)] } });
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
    const h = harness(twoPages());
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
    const h = harness({
      ":": { entries: [entry("a", 200)], nextCursor: "p2" },
      ":p2": { entries: [], nextCursor: "p3" },
    });
    await h.loaded();
    await h.more();
    expect(h.load.activityHasMore()).toBe(false);
  });

  test("an empty newest page keeps the cursor it was given", async () => {
    const h = harness({ ":": { entries: [], nextCursor: "p2" } });
    await h.loaded();
    expect(h.load.activityHasMore()).toBe(true);
  });

  test("loading more before the first page arrives is ignored", async () => {
    const h = harness(twoPages(), { ready: false });
    h.load.loadMoreActivity();
    flush();
    await wait(5);
    expect(h.fetches).toHaveLength(0);
  });

  test("a failed page keeps the items, rejects, and retries the same cursor", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    try {
      const h = harness(twoPages());
      await h.loaded();
      h.failOnce(undefined, "p2");
      h.load.loadMoreActivity();
      flush();
      await expect(until(() => h.load.activityMore()?.id === 99)).rejects.toThrow();
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
    const h = harness({
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
    const h = harness({
      ":": { entries: [entry("a", 100)], nextCursor: "main" },
      ":|unread": { entries: [entry("u", 50)] },
    });
    await h.loaded();
    await h.more(undefined, true);
    expect(h.load.activityHasMore(undefined, true)).toBe(false);
    expect(h.load.activityHasMore()).toBe(true);
  });
});

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
    for (const dispose of disposers.splice(0)) dispose();
    await wait(300);
    expect(h.fetches).toHaveLength(1);
  });
});
