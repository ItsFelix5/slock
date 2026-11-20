import { describe, expect, test } from "bun:test";
import { systemEnv } from "@slock/core";
import { ch, stamp, uid } from "@slock/slack/testing";
import type { ActivityItem, Message, User } from "@slock/types";
import { createRoot } from "solid-js";
import { createActivityStore } from "../../../../src/activity/client/store/index";

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

function setup(options: { failArchive?: boolean; reactedBy?: ReturnType<typeof uid>[] } = {}) {
  const archived: unknown[][] = [];
  const marked: unknown[][] = [];
  const store = createRoot(() =>
    createActivityStore(
      {
        clearChannelUnread: () => {},
        currentUser: () => me,
        env: systemEnv,
        lastReadByChannel: {},
        ready: () => false,
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
      },
    ),
  );
  return { archived, marked, store };
}

describe("archiveActivity", () => {
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
    const { archived, store } = setup({ failArchive: true });
    await expect(store.archiveActivity(reminder)).rejects.toThrow("boom");
    expect(store.isActivityItemArchived(reminder)).toBe(false);
    await expect(store.archiveActivity(reminder)).rejects.toThrow("boom");
    expect(archived).toHaveLength(2);
  });

  test("a reaction I also gave counts as archived without a request", async () => {
    const { archived, store } = setup({ reactedBy: [uid("U1")] });
    const reaction: ActivityItem = { ...reminder, activityType: undefined, kind: "reaction" };
    expect(store.isActivityItemArchived(reaction)).toBe(true);
    await store.archiveActivity(reaction);
    expect(archived).toEqual([]);
  });
});
