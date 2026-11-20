import { describe, expect, test } from "bun:test";
import { systemEnv } from "@slock/core";
import { ch, stamp, uid } from "@slock/slack/testing";
import type { FeedEntry, Message, User } from "@slock/types";
import { createRoot } from "solid-js";
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

type Pages = Record<string, { entries: FeedEntry[]; nextCursor?: string }>;

function harness(pages: Pages) {
  const fetches: { cursor?: string; types?: string }[] = [];
  const reactionFlashes: string[] = [];
  const activityItems = createActivityItems();
  const items = activityItems.list;
  let failNextFetch = false;
  let delayFetchMs = 0;
  const load = createActivityFeedLoad({
    backfillMissingReadCursors: async () => {},
    currentUser: () => me,
    env: systemEnv,
    fetchActivityFeedEntries: async (_limit, cursor, types) => {
      fetches.push({ cursor, types });
      if (delayFetchMs) await wait(delayFetchMs);
      if (failNextFetch) {
        failNextFetch = false;
        throw new Error("down");
      }
      return pages[types ? `${types}:${cursor ?? ""}` : (cursor ?? "")] ?? { entries: [] };
    },
    fetchHistoryAround: async () => ({ messages: [] }),
    fetchMessagesByIds: async () => new Map<string, Message>(),
    items: activityItems,
    onReactionPushed: (name) => reactionFlashes.push(name),
    resolveActivityEntry: (raw) => ({ ...raw, text: raw.text ?? "" }),
  });
  return {
    failNextFetch: () => {
      failNextFetch = true;
    },
    fetches,
    ids: () => items.map((item) => item.id),
    items,
    load,
    reactionFlashes,
    setDelay: (ms: number) => {
      delayFetchMs = ms;
    },
  };
}

function inRoot<T>(run: () => Promise<T>): Promise<T> {
  return createRoot(async (dispose) => {
    try {
      return await run();
    } finally {
      dispose();
    }
  });
}

describe("createActivityFeedLoad", () => {
  test("loads newest first and drops own thread replies", async () => {
    await inRoot(async () => {
      const h = harness({
        "": {
          entries: [
            entry("a", 100),
            entry("c", 300),
            entry("b", 200, { kind: "thread_reply", userId: uid("U1") }),
          ],
        },
      });
      await h.load.ensureActivityLoaded();
      expect(h.ids()).toEqual(["c", "a"]);
      expect(h.load.activityLoaded()).toBe(true);
    });
  });

  test("a failed load can be retried", async () => {
    await inRoot(async () => {
      const h = harness({ "": { entries: [entry("a", 100)] } });
      h.failNextFetch();
      await h.load.ensureActivityLoaded();
      expect(h.load.activityLoadError()).toBe(true);
      expect(h.load.activityLoaded()).toBe(false);
      await h.load.ensureActivityLoaded();
      expect(h.load.activityLoadError()).toBe(true);
      await h.load.retryActivityLoad();
      expect(h.load.activityLoadError()).toBe(false);
      expect(h.ids()).toEqual(["a"]);
    });
  });

  test("pagination appends older pages in order and stops without a cursor", async () => {
    await inRoot(async () => {
      const h = harness({
        "": { entries: [entry("n3", 300), entry("n2", 200)], nextCursor: "p2" },
        p2: { entries: [entry("n1", 100)] },
      });
      await h.load.ensureActivityLoaded();
      expect(h.load.activityHasMore()).toBe(true);
      await h.load.loadMoreActivity();
      expect(h.ids()).toEqual(["n3", "n2", "n1"]);
      expect(h.load.activityHasMore()).toBe(false);
      await h.load.loadMoreActivity();
      expect(h.fetches).toHaveLength(2);
    });
  });

  test("a failed page load keeps the items and can be retried", async () => {
    await inRoot(async () => {
      const h = harness({
        "": { entries: [entry("a", 200)], nextCursor: "p2" },
        p2: { entries: [entry("b", 100)] },
      });
      await h.load.ensureActivityLoaded();
      h.failNextFetch();
      await h.load.loadMoreActivity();
      expect(h.load.activityLoadMoreError()).toBe(true);
      expect(h.ids()).toEqual(["a"]);
      await h.load.loadMoreActivity();
      expect(h.load.activityLoadMoreError()).toBe(false);
      expect(h.ids()).toEqual(["a", "b"]);
    });
  });

  test("scoped feeds keep their own cursors", async () => {
    await inRoot(async () => {
      const h = harness({
        "": { entries: [entry("a", 100)], nextCursor: "main" },
        "keyword:": { entries: [entry("s", 50)] },
      });
      await h.load.ensureActivityLoaded();
      await h.load.loadMoreActivity("keyword");
      expect(h.fetches.at(-1)).toEqual({ cursor: undefined, types: "keyword" });
      expect(h.load.activityHasMore("keyword")).toBe(false);
      expect(h.load.activityHasMore()).toBe(true);
    });
  });

  test("duplicate ids and repeated reactions are pushed once", async () => {
    await inRoot(async () => {
      const reaction = (id: string, time: number) =>
        entry(id, time, {
          kind: "reaction",
          reactionName: "tada",
          ts: stamp("5.5"),
          userId: uid("U3"),
        });
      const h = harness({
        "": {
          entries: [entry("a", 100), entry("a", 100), reaction("r1", 200), reaction("r2", 300)],
        },
      });
      await h.load.ensureActivityLoaded();
      expect(h.ids().sort()).toEqual(["a", "r1"]);
    });
  });

  test("equal times keep arrival order", async () => {
    await inRoot(async () => {
      const h = harness({
        "": { entries: [entry("x", 100), entry("y", 100), entry("z", 100)] },
      });
      await h.load.ensureActivityLoaded();
      expect(h.ids()).toEqual(["x", "y", "z"]);
    });
  });

  test("refreshing while loading more never duplicates items", async () => {
    await inRoot(async () => {
      const h = harness({
        "": { entries: [entry("n3", 300), entry("n2", 200)], nextCursor: "p2" },
        p2: { entries: [entry("n1", 100)] },
      });
      await h.load.ensureActivityLoaded();
      h.setDelay(10);
      const more = h.load.loadMoreActivity();
      const refresh = h.load.ensureActivityLoaded();
      h.load.requestActivityRefresh();
      await Promise.all([more, refresh]);
      await wait(20);
      expect(new Set(h.ids()).size).toBe(h.ids().length);
    });
  });

  test("a live refresh updates an item that got newer activity", async () => {
    await inRoot(async () => {
      const h = harness({
        "": {
          entries: [
            entry("t", 100, { kind: "thread_reply", threadTs: stamp("9.9"), unreadCount: 1 }),
          ],
        },
      });
      await h.load.ensureActivityLoaded();
      const pages: Pages = {
        "": {
          entries: [
            entry("t", 500, { kind: "thread_reply", threadTs: stamp("9.9"), unreadCount: 4 }),
            entry("n", 300),
          ],
        },
      };
      const fresh = harness(pages);
      await fresh.load.ensureActivityLoaded();
      expect(fresh.items.find((item) => item.id === "t")?.unreadCount).toBe(4);
      expect(fresh.ids()).toEqual(["t", "n"]);
    });
  });

  test("a pending live refresh is dropped when the store is disposed", async () => {
    let fetches!: unknown[];
    await createRoot(async (dispose) => {
      const { fetches: recorded, load } = harness({ "": { entries: [entry("a", 100)] } });
      fetches = recorded;
      load.requestActivityRefresh();
      dispose();
      await wait(300);
    });
    expect(fetches).toHaveLength(0);
  });

  test("an update refreshes the feed without the view open", async () => {
    await inRoot(async () => {
      const h = harness({ "": { entries: [entry("a", 100)] } });
      h.load.requestActivityRefresh();
      await wait(300);
      expect(h.fetches).toHaveLength(1);
    });
  });
});
