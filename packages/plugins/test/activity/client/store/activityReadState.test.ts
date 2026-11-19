import { describe, expect, test } from "bun:test";
import type { ActivityItem } from "@slock/types";
import { createRoot } from "solid-js";
import { createStore } from "solid-js";
import { PING_KINDS } from "../../../../src/activity/client/kinds";
import { createActivityReadState } from "../../../../src/activity/client/store/activityReadState";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const item = (id: string, patch: Partial<ActivityItem> = {}): ActivityItem => ({
  channelId: "C1",
  id,
  kind: "mention",
  text: id,
  time: 1,
  ts: "10.000",
  unread: true,
  userId: "U2",
  ...patch,
});

const reminder = (patch: Partial<ActivityItem> = {}) =>
  item("r1", {
    activityType: "saved_reminder",
    channelId: "",
    feedTs: "9.9",
    kind: "other",
    linkedItemId: "Rm1",
    ...patch,
  });

function setup(initial: ActivityItem[], options: { lastRead?: number; failMark?: boolean } = {}) {
  const marked: unknown[][] = [];
  const channelSyncs: [string, string][] = [];
  const threadSyncs: [string, string, string][] = [];
  const cleared: string[] = [];
  const lastRead: Record<string, number> = options.lastRead ? { C1: options.lastRead } : {};
  const [items, setItems] = createStore<ActivityItem[]>(initial);
  const state = createActivityReadState({
    activityItems: items,
    activityReadSync: {
      request: (channelId, ts) => {
        channelSyncs.push([channelId, ts]);
        return Promise.resolve(true);
      },
    },
    clearChannelUnread: (channelId) => cleared.push(channelId),
    fetchActivityBadgeCounts: () => Promise.resolve({ at_user: 2 }),
    fetchChannelLastRead: () => Promise.resolve(0),
    lastReadByChannel: lastRead,
    markActivityRead: (...args) => {
      marked.push(args);
      return options.failMark ? Promise.reject(new Error("boom")) : Promise.resolve();
    },
    pingKinds: PING_KINDS,
    setActivityItems: (predicate, key, value) => setItems(predicate, key, value),
    setLastReadByChannel: (channelId, ts) => {
      lastRead[channelId] = ts;
    },
    setThreadRead: (channelId, threadTs, ts) => {
      threadSyncs.push([channelId, threadTs, ts]);
      return Promise.resolve(true);
    },
    threadReadTsFor: () => undefined,
  });
  return { channelSyncs, cleared, items, lastRead, marked, state, threadSyncs };
}

const inRoot = <T>(build: () => T) => createRoot(build);

describe("read state", () => {
  test.each([
    ["unread from the feed", item("a"), "unread"],
    ["read from the feed", item("a", { unread: false }), "read"],
    ["unknown until the feed says", item("a", { unread: undefined }), "pending"],
    ["reactions are always read", item("a", { kind: "reaction" }), "read"],
    [
      "thread replies follow their count",
      item("a", { kind: "thread_reply", unreadCount: 2 }),
      "unread",
    ],
    [
      "a thread reply with no count left",
      item("a", { kind: "thread_reply", unreadCount: 0 }),
      "read",
    ],
  ] as [string, ActivityItem, "pending" | "read" | "unread"][])("%s", (_name, entry, expected) => {
    inRoot(() => expect(setup([entry]).state.activityItemReadState(entry)).toBe(expected));
  });

  test("marking read then unread brings back an item the feed called read", () => {
    inRoot(() => {
      const entry = item("a", { unread: false });
      const { state } = setup([entry]);
      expect(state.isActivityItemUnread(entry)).toBe(false);
      state.markActivityItemUnread(entry);
      expect(state.isActivityItemUnread(entry)).toBe(true);
    });
  });

  test("marking a thread reply unread restores at least one unread", () => {
    inRoot(() => {
      const entry = item("a", { kind: "thread_reply", threadTs: "1.1", unreadCount: 0 });
      const { items, state } = setup([entry]);
      state.markActivityItemUnread(entry);
      expect(items[0]?.unreadCount).toBe(1);
    });
  });
});

describe("markActivityItemsRead for reminders", () => {
  test.each([
    "saved_reminder",
    "quietly_added_to_channel",
  ])("%s is marked read on the server with only type, feed ts and key", async (activityType) => {
    const entry = reminder({ activityType });
    const { channelSyncs, marked, state, threadSyncs } = inRoot(() => setup([entry]));
    state.markActivityItemsRead([entry]);
    await flush();
    expect(marked).toEqual([[activityType, "9.9", "r1"]]);
    expect(state.isActivityItemUnread(entry)).toBe(false);
    expect(channelSyncs).toEqual([]);
    expect(threadSyncs).toEqual([]);
  });

  test("falls back to the entry ts when there is no feed ts", async () => {
    const entry = reminder({ feedTs: undefined, ts: "4.4" });
    const { marked, state } = inRoot(() => setup([entry]));
    state.markActivityItemsRead([entry]);
    await flush();
    expect(marked).toEqual([["saved_reminder", "4.4", "r1"]]);
  });

  test("stays unread when the server write fails", async () => {
    const entry = reminder();
    const { state } = inRoot(() => setup([entry], { failMark: true }));
    state.markActivityItemsRead([entry]);
    await flush();
    expect(state.isActivityItemUnread(entry)).toBe(true);
  });

  test("an already read reminder is not marked twice", async () => {
    const entry = reminder();
    const { marked, state } = inRoot(() => setup([entry]));
    state.markActivityItemsRead([entry]);
    await flush();
    state.markActivityItemsRead([entry]);
    await flush();
    expect(marked).toHaveLength(1);
  });

  test("refreshes the badge count after marking", async () => {
    const entry = reminder();
    const { state } = inRoot(() => setup([entry]));
    state.markActivityItemsRead([entry]);
    await flush();
    expect(state.unreadPingCount()).toBe(2);
  });
});

describe("markActivityItemsRead for messages", () => {
  test("syncs the newest ts per channel and clears the unread flag", async () => {
    const entries = [item("a", { ts: "10.000" }), item("b", { ts: "12.000" })];
    const { channelSyncs, cleared, lastRead, state } = inRoot(() => setup(entries));
    state.markActivityItemsRead(entries);
    await flush();
    expect(channelSyncs).toEqual([["C1", "12.000"]]);
    expect(cleared).toEqual(["C1"]);
    expect(lastRead.C1).toBe(12000);
    expect(entries.every((entry) => !state.isActivityItemUnread(entry))).toBe(true);
  });

  test("does not move the channel cursor backwards", async () => {
    const entries = [item("a", { ts: "10.000" })];
    const { channelSyncs, lastRead, state } = inRoot(() => setup(entries, { lastRead: 20_000 }));
    state.markActivityItemsRead(entries);
    await flush();
    expect(channelSyncs).toEqual([]);
    expect(lastRead.C1).toBe(20_000);
  });

  test("thread replies sync the thread cursor, not the channel", async () => {
    const entries = [
      item("a", { threadTs: "1.000", ts: "10.000" }),
      item("b", { threadTs: "1.000", ts: "11.000" }),
    ];
    const { channelSyncs, state, threadSyncs } = inRoot(() => setup(entries));
    state.markActivityItemsRead(entries);
    await flush();
    expect(threadSyncs).toEqual([["C1", "1.000", "11.000"]]);
    expect(channelSyncs).toEqual([]);
  });

  test("items without a channel are only marked locally", async () => {
    const entry = item("a", { channelId: "" });
    const { channelSyncs, marked, state } = inRoot(() => setup([entry]));
    state.markActivityItemsRead([entry]);
    await flush();
    expect(state.isActivityItemUnread(entry)).toBe(false);
    expect(channelSyncs).toEqual([]);
    expect(marked).toEqual([]);
  });
});

describe("unread counts", () => {
  test("counts unread items and pings", () => {
    inRoot(() => {
      const entries = [
        item("a"),
        item("b", { kind: "channel_all" }),
        item("c", { unread: false }),
        item("d", { kind: "reaction" }),
      ];
      const { state } = setup(entries);
      expect(state.unreadActivityCount()).toBe(2);
      expect(state.unreadPingCount()).toBe(1);
      expect(state.hasUnreadActivity()).toBe(true);
    });
  });

  test("gateway counts win once they arrive and negative counts are ignored", () => {
    inRoot(() => {
      const { state } = setup([item("a")]);
      state.setGatewayActivityBadgeCounts({ at_user: -3, dm: 1 });
      expect(state.unreadPingCount()).toBe(1);
    });
  });
});
