import { describe, expect, test } from "bun:test";
import { ch, stamp, uid } from "@slock/slack/testing";
import type { ActivityItem, FeedEntry, User } from "@slock/types";
import {
  applyStaleEntries,
  seenSetsFor,
  staleEntries,
} from "../../../../src/activity/client/store/feedMerge";

const me: User = { avatarColor: "", id: uid("U1"), name: "me" };

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

const resolve = (raw: FeedEntry): ActivityItem => ({ ...raw, text: raw.text ?? "" });
const items = (...entries: FeedEntry[]): ActivityItem[] => entries.map(resolve);

describe("seenSetsFor", () => {
  test("indexes ids, channel posts and reactions separately", () => {
    const list = items(
      entry("m", 1),
      entry("p", 2, { kind: "channel_all" }),
      entry("r", 3, { kind: "reaction", reactionName: "tada", ts: stamp("5.5") }),
    );
    const { seen, seenChannelPosts, seenReactions } = seenSetsFor(list);
    expect([...seen]).toEqual(["m", "p", "r"]);
    expect(seenChannelPosts.size).toBe(1);
    expect(seenReactions.size).toBe(1);
  });
});

describe("staleEntries", () => {
  test("keeps only known entries that got newer, never unknown ones", () => {
    const known = items(entry("a", 100), entry("b", 100));
    const stale = staleEntries([entry("a", 200), entry("b", 100), entry("c", 900)], known);
    expect(stale.map((e) => e.id)).toEqual(["a"]);
  });
});

describe("applyStaleEntries", () => {
  test("updates in place, keeps old text and user when the new entry has none, and resorts", () => {
    const list = items(entry("a", 100, { text: "old" }), entry("b", 200));
    const newer = entry("a", 300, { text: "", unreadCount: 5, userId: uid("U9") });
    applyStaleEntries(list, [newer], resolve, new Map(), me);
    expect(list.map((item) => item.id)).toEqual(["a", "b"]);
    expect(list[0]).toMatchObject({ text: "old", time: 300, unreadCount: 5 });
  });

  test("ignores a resolution older than what is shown", () => {
    const list = items(entry("a", 300));
    applyStaleEntries(list, [entry("a", 200)], resolve, new Map(), me);
    expect(list[0]?.time).toBe(300);
  });

  test("drops an item that now resolves to my own activity", () => {
    const list = items(entry("a", 100), entry("b", 90));
    applyStaleEntries(
      list,
      [entry("a", 200, { kind: "thread_reply", userId: me.id })],
      resolve,
      new Map(),
      me,
    );
    expect(list.map((item) => item.id)).toEqual(["b"]);
  });
});
