import { describe, expect, test } from "bun:test";
import { forAll, int, pick, text } from "@slock/core/testing";
import type { RawActivityFeedEntry } from "@slock/types";
import { ACTIVITY_KIND_FEED_TYPES, mapFeedEntry } from "../../../src/activity/client/feedEntry";
import { ACTIVITY_FEED_TYPES } from "../../../src/activity/protocol/feedTypes";

const TIME = 1_700_000_000_000;

describe("mapFeedEntry", () => {
  test("maps an at_user mention with its message", () => {
    const entry = mapFeedEntry(
      {
        feed_ts: "1700000000.000100",
        is_unread: true,
        item: {
          message: { channel: "C1234567890", text: "hi @me", ts: "1699999999.000200", user: "U2" },
          type: "at_user",
        },
        key: "mention-1",
      },
      TIME,
    );
    expect(entry).toMatchObject({
      channelId: "C1234567890",
      id: "mention-1",
      kind: "mention",
      text: "hi @me",
      threadTs: undefined,
      time: TIME,
      ts: "1699999999.000200",
      unread: true,
      userId: "U2",
    });
  });

  test("keeps thread_ts only when it differs from ts", () => {
    const entry = (threadTs: string) =>
      mapFeedEntry(
        {
          feed_ts: "1.1",
          item: {
            message: { channel: "C1234567890", thread_ts: threadTs, ts: "5.5", user: "U2" },
            type: "at_user",
          },
        },
        TIME,
      );
    expect(entry("5.5")?.threadTs).toBeUndefined();
    expect(entry("4.4")?.threadTs).toBe("4.4");
  });

  test("maps reactions to the reacted message and the reacting user", () => {
    const entry = mapFeedEntry(
      {
        feed_ts: "2.2",
        item: {
          message: { channel: "C1234567890", text: "mine", thread_ts: "1.1", ts: "3.3" },
          reaction: { name: "tada", user: "U9" },
          type: "message_reaction",
        },
        key: "r1",
      },
      TIME,
    );
    expect(entry).toMatchObject({
      channelId: "C1234567890",
      kind: "reaction",
      reactionName: "tada",
      threadTs: "1.1",
      ts: "3.3",
      userId: "U9",
    });
  });

  test("maps thread_v2 bundles with unread counts", () => {
    const entry = mapFeedEntry(
      {
        feed_ts: "9.9",
        is_unread: true,
        item: {
          bundle_info: {
            payload: {
              thread_entry: {
                channel_id: "C1234567890",
                latest_message: { text: "latest", ts: "8.8", user: "U3" },
                latest_ts: "8.8",
                thread_ts: "1.1",
                unread_msg_count: 4,
              },
            },
          },
          type: "thread_v2",
        },
        key: "t1",
      },
      TIME,
    );
    expect(entry).toMatchObject({
      channelId: "C1234567890",
      kind: "thread_reply",
      text: "latest",
      threadTs: "1.1",
      ts: "8.8",
      unreadCount: 4,
      userId: "U3",
    });
  });

  test("derives channel and ts from sparse feed keys", () => {
    const entry = mapFeedEntry(
      { feed_ts: "7.7", item: { type: "internal_channel_invite" }, key: "invite:C1234567890" },
      TIME,
    );
    expect(entry).toMatchObject({ channelId: "C1234567890", ts: "7.7" });
  });

  test("channel less items get an empty channel id and a stable id", () => {
    const entry = mapFeedEntry(
      { feed_ts: "7.7", item: { activity_text: "Due now", type: "saved_reminder" } },
      TIME,
    );
    expect(entry).toMatchObject({ channelId: "", id: "saved_reminder:7.7", kind: "other" });
  });

  test("a reminder resolved to a message keeps its link to the saved item", () => {
    const entry = mapFeedEntry(
      {
        feed_ts: "9.9",
        is_unread: true,
        item: {
          activity_text: "Review the doc",
          channel_id: "C1234567890",
          linked_item_id: "Rm1",
          message_ts: "3.3",
          type: "saved_reminder",
        },
        key: "reminder:Rm1",
      },
      TIME,
    );
    expect(entry).toMatchObject({
      activityType: "saved_reminder",
      channelId: "C1234567890",
      feedTs: "9.9",
      id: "reminder:Rm1",
      kind: "other",
      linkedItemId: "Rm1",
      text: "Review the doc",
      ts: "3.3",
      unread: true,
    });
  });

  test("a reminder that could not be resolved keeps its link and the feed ts", () => {
    const entry = mapFeedEntry(
      { feed_ts: "9.9", item: { linked_item_id: "Rm1", type: "saved_reminder" }, key: "k" },
      TIME,
    );
    expect(entry).toMatchObject({ channelId: "", linkedItemId: "Rm1", ts: "9.9" });
  });

  test("broadcast mentions set the range", () => {
    const base = { channel: "C1234567890", ts: "1.1", user: "U1" };
    const range = (type: string) =>
      mapFeedEntry({ feed_ts: "1.1", item: { message: base, type } }, TIME)?.broadcastRange;
    expect(range("at_channel")).toBe("channel");
    expect(range("at_everyone")).toBe("everyone");
    expect(range("at_user")).toBeUndefined();
  });

  test("unknown types fall back to other", () => {
    const entry = mapFeedEntry(
      { feed_ts: "1.1", item: { channel_id: "C1234567890", ts: "1.1", type: "brand_new" } },
      TIME,
    );
    expect(entry?.kind).toBe("other");
  });

  test.each([
    ["no item", { feed_ts: "1.1" }],
    ["no type", { feed_ts: "1.1", item: {} }],
    ["no feed_ts", { item: { channel_id: "C1234567890", ts: "1.1", type: "at_user" } }],
  ] as [string, RawActivityFeedEntry][])("drops entries with %s", (_name, raw) => {
    expect(mapFeedEntry(raw, Number.parseFloat(raw.feed_ts ?? "") * 1000)).toBeUndefined();
  });

  test("property: never throws on partial payloads", () => {
    const types = [...ACTIVITY_FEED_TYPES, "other_thing"];
    const alphabet = "CGU0123456789ABC.";
    forAll(
      (random) => {
        const some = <T>(value: T): T | undefined => (random() < 0.5 ? value : undefined);
        const message = some({
          channel: some(text(random, alphabet, 12)),
          text: some(text(random, "ab😀")),
          thread_ts: some(text(random, alphabet, 6)),
          ts: some(text(random, alphabet, 6)),
          user: some(text(random, alphabet, 6)),
        });
        return {
          feed_ts: some(`${int(random, 1, 99)}.${int(random, 1, 99)}`),
          is_unread: some(random() < 0.5),
          item: some({
            bundle_info: some({ payload: some({ channel_entry: some({}), message }) }),
            message,
            reaction: some({ name: some("x") }),
            type: pick(random, types),
          }),
          key: some(text(random, alphabet, 12)),
        } satisfies RawActivityFeedEntry;
      },
      (raw) => {
        const entry = mapFeedEntry(raw, Number.parseFloat(raw.feed_ts ?? "") * 1000);
        if (entry) expect(entry.id).toBeTruthy();
      },
    );
  });
});

describe("ACTIVITY_KIND_FEED_TYPES", () => {
  test("every feed type belongs to exactly one kind", () => {
    const all = Object.values(ACTIVITY_KIND_FEED_TYPES).flat();
    expect(all.sort()).toEqual([...ACTIVITY_FEED_TYPES].sort());
  });
});
