import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { systemEnv } from "@slock/core";
import type { ActivityItem, Message, User } from "@slock/types";
import { createRoot } from "solid-js";
import { createActivityStore } from "../../../../../packages/plugins/src/activity/client/store/index";
import { startQueryHost } from "../../../../support/queryHost";
import { ch, stamp, uid } from "../../../../support/slack";

const me: User = { avatarColor: "", id: uid("U1"), name: "me" };

const reactedMessage = (users: ReturnType<typeof uid>[]): Message => ({
  day: "",
  id: stamp("1.1"),
  kind: "normal",
  reactions: [{ count: users.length, name: "tada", users }],
  text: "",
  time: "",
  ts: stamp("3.3"),
  userId: uid("U2"),
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const reminder: ActivityItem = {
  activityType: "saved_reminder",
  channelId: ch("C1"),
  feedTs: stamp("9.9"),
  id: "reminder:Rm1",
  kind: "other",
  linkedItemId: "Rm1",
  text: "Review",
  time: 1,
  ts: stamp("3.3"),
  unread: true,
  userId: uid("U2"),
};

type Setup = {
  api?: NonNullable<Parameters<typeof createActivityStore>[1]>;
  failArchive?: boolean;
  reactedBy?: ReturnType<typeof uid>[];
  ready?: boolean;
};

function setup(options: Setup = {}) {
  const archived: unknown[][] = [];
  const marked: unknown[][] = [];
  const store = createRoot(() =>
    createActivityStore(
      {
        clearChannelUnread: () => {},
        currentUser: () => me,
        env: systemEnv,
        lastReadByChannel: {},
        ready: () => options.ready ?? false,
        reactionMessageFor: () => reactedMessage(options.reactedBy ?? []),
        setLastReadByChannel: () => {},
        syncChannelRead: () => Promise.resolve(true),
        setThreadRead: () => Promise.resolve(true),
        threadReadTsFor: () => undefined,
      },
      {
        archiveActivityItem: (...args) => {
          archived.push(args);
          return options.failArchive ? Promise.reject(new Error("boom")) : Promise.resolve();
        },
        fetchActivityBadgeCounts: () => Promise.resolve({}),
        markActivityRead: (...args) => {
          marked.push(args);
          return Promise.resolve();
        },
        ...options.api,
      },
    ),
  );
  return { archived, marked, store };
}

describe("applyActivityEvent", () => {
  const raw = (ts: string) => ({
    feed_ts: ts,
    is_unread: true,
    item: { message: { channel: "C1", text: "hi", ts, user: "U2" }, type: "at_user" },
    key: "at_user-C1",
  });

  async function loadedStore() {
    await startQueryHost();
    let fetches = 0;
    const { store } = setup({
      api: {
        fetchActivityFeedEntries: () => {
          fetches++;
          return Promise.resolve({ entries: [] });
        },
        fetchMessagesByIds: () => Promise.resolve(new Map()),
      },
      ready: true,
    });
    await flush();
    return { fetches: () => fetches, store };
  }

  test("applies an updated and a deleted entry without fetching the feed", async () => {
    const { fetches, store } = await loadedStore();
    store.applyActivityEvent({ entry: raw("5.000000"), subtype: "activity_updated" });
    await flush();
    expect(store.activityItems.map((item) => item.ts)).toEqual([stamp("5.000000")]);
    store.applyActivityEvent({ entry: raw("6.000000"), subtype: "activity_updated" });
    await flush();
    expect(store.activityItems.map((item) => item.ts)).toEqual([stamp("6.000000")]);
    store.applyActivityEvent({ entry: raw("6.000000"), subtype: "activity_deleted" });
    await flush();
    expect(store.activityItems).toHaveLength(0);
    expect(fetches()).toBe(1);
  });

  test("an unknown frame is reported and a type outside the feed is ignored", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);
    const { store } = await loadedStore();
    store.applyActivityEvent({
      entry: { ...raw("5.000000"), item: { type: "not_in_feed" } },
      subtype: "activity_updated",
    });
    expect(warn).not.toHaveBeenCalled();
    store.applyActivityEvent({ subtype: "activity_surprise" });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("archiveActivity", () => {
  beforeEach(async () => {
    await startQueryHost();
  });

  test("sends the linked item of a reminder and marks the entry read", async () => {
    const { archived, marked, store } = setup();
    await store.archiveActivity(reminder);
    await flush();
    expect(archived).toEqual([["saved_reminder", "reminder:Rm1", "3.3", "Rm1"]]);
    expect(store.isActivityItemArchived(reminder)).toBe(true);
    expect(marked).toEqual([["saved_reminder", "9.9", "reminder:Rm1"]]);
  });

  test("falls back to the kind when the item has no activity type", async () => {
    const { archived, store } = setup();
    await store.archiveActivity({ ...reminder, activityType: undefined, linkedItemId: undefined });
    expect(archived).toEqual([["other", "reminder:Rm1", "3.3", undefined]]);
  });

  test("the same item is only archived once while a request is in flight", async () => {
    const { archived, store } = setup();
    await Promise.all([store.archiveActivity(reminder), store.archiveActivity(reminder)]);
    expect(archived).toHaveLength(1);
  });

  test("an archived item is not archived again", async () => {
    const { archived, store } = setup();
    await store.archiveActivity(reminder);
    await store.archiveActivity(reminder);
    expect(archived).toHaveLength(1);
  });

  test("a failed archive leaves the item active and can be retried", async () => {
    const errors = spyOn(console, "error").mockImplementation(() => undefined);
    const { archived, store } = setup({ failArchive: true });
    expect(await store.archiveActivity(reminder)).toBe(false);
    expect(store.isActivityItemArchived(reminder)).toBe(false);
    expect(await store.archiveActivity(reminder)).toBe(false);
    expect(archived).toHaveLength(2);
    expect(errors).toHaveBeenCalledTimes(2);
    errors.mockRestore();
  });

  test("a reaction I also gave counts as archived without a request", async () => {
    const { archived, store } = setup({ reactedBy: [uid("U1")] });
    const reaction: ActivityItem = { ...reminder, activityType: undefined, kind: "reaction" };
    expect(store.isActivityItemArchived(reaction)).toBe(true);
    await store.archiveActivity(reaction);
    expect(archived).toEqual([]);
  });
});
