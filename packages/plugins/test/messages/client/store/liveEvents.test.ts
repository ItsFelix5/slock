import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { defined } from "@slock/core";
import { forAll, int, pick } from "@slock/core/testing";
import { ch, stamp } from "@slock/slack/testing";
import type { ChannelId, Ts } from "@slock/types";
import { createStoreHarness, ME, OTHER, type StoreHarness, settle } from "./storeHarness";

const C1 = ch("C1");
const C2 = ch("C2");
const C3 = ch("C3");

let h: StoreHarness;

beforeEach(async () => {
  h = await createStoreHarness();
  h.open(C1);
  await settle();
});

afterEach(() => h.dispose());

const texts = (channel: ChannelId) => h.messages(channel).map((m) => m.text);
const find = (channel: ChannelId, ts: Ts) => h.messages(channel).find((m) => m.ts === ts);

describe("thread reply counts", () => {
  test("any event order, with replays, ends at the server count", () => {
    forAll(
      (random) =>
        Array.from({ length: int(random, 1, 6) }, () => ({
          order: pick(random, ["message first", "replied first"] as const),
          replays: int(random, 0, 2),
        })),
      (replies) => {
        const parent = h.slack.say(C1, OTHER, "parent");
        h.deliver(h.slack.echo(C1, parent));
        for (const { order, replays } of replies) {
          const reply = h.slack.say(C1, OTHER, "reply", { threadTs: stamp(parent.ts) });
          const message = () => h.deliver(h.slack.echo(C1, reply));
          const replied = () => h.deliver(h.slack.replied(C1, stamp(parent.ts)));
          if (order === "message first") {
            message();
            replied();
          } else {
            replied();
            message();
          }
          for (let i = 0; i < replays; i++) message();
        }
        expect(find(C1, stamp(parent.ts))?.replyCount).toBe(replies.length);
      },
      80,
    );
  });

  test("my own reply is counted once however the echo and the POST interleave", async () => {
    const parent = h.slack.say(C1, OTHER, "parent");
    const ts = stamp(parent.ts);
    h.deliver(h.slack.echo(C1, parent));
    h.openThread({ channelId: C1, ts });
    await settle();
    const release = h.slack.holdPosts();
    const sending = h.store.sendMessage(C1, "mine", [], ts);
    await settle();
    release();
    await sending;
    h.deliver(h.slack.echo(C1, defined(h.slack.findPosted(C1, "mine"))));
    h.deliver(h.slack.replied(C1, stamp(parent.ts)));
    expect(find(C1, ts)?.replyCount).toBe(1);
    expect(h.thread(ts).filter((m) => m.text === "mine")).toHaveLength(1);
  });

  test("replies reach an open thread but never the channel list", async () => {
    const parent = h.slack.say(C1, OTHER, "parent");
    const ts = stamp(parent.ts);
    h.deliver(h.slack.echo(C1, parent));
    h.openThread({ channelId: C1, ts });
    await settle();
    h.deliver(h.slack.echo(C1, h.slack.say(C1, OTHER, "r1", { threadTs: stamp(parent.ts) })));
    expect(texts(C1)).toEqual(["parent"]);
    expect(h.thread(ts).map((m) => m.text)).toEqual(["parent", "r1"]);
  });

  test("a broadcast reply shows in both places and survives an edit", async () => {
    const parent = h.slack.say(C1, OTHER, "parent");
    const ts = stamp(parent.ts);
    h.deliver(h.slack.echo(C1, parent));
    h.openThread({ channelId: C1, ts });
    await settle();
    const reply = h.slack.say(C1, OTHER, "also channel", {
      subtype: "thread_broadcast",
      threadTs: stamp(parent.ts),
    });
    h.deliver(h.slack.echo(C1, reply));
    expect(texts(C1)).toEqual(["parent", "also channel"]);
    expect(h.thread(ts).map((m) => m.text)).toEqual(["parent", "also channel"]);

    reply.text = "edited";
    h.deliver(h.slack.edited(C1, stamp(reply.ts)));
    expect(texts(C1)).toEqual(["parent", "edited"]);
    expect(h.thread(ts).map((m) => m.text)).toEqual(["parent", "edited"]);
  });
});

describe("one message living in several stores", () => {
  async function threadParent() {
    const parent = h.slack.say(C1, OTHER, "parent");
    h.deliver(h.slack.echo(C1, parent));
    h.openThread({ channelId: C1, ts: stamp(parent.ts) });
    await settle();
    return parent;
  }

  test("edits and reactions reach the channel copy and the thread copy", async () => {
    const parent = await threadParent();
    const ts = stamp(parent.ts);
    parent.text = "parent v2";
    h.deliver(h.slack.edited(C1, stamp(parent.ts)));
    h.deliver({
      item: { channel: C1, ts: stamp(parent.ts) },
      reaction: "tada",
      type: "reaction_added",
      user: OTHER,
    });
    for (const copy of [find(C1, ts), h.thread(ts)[0]]) {
      expect(copy?.text).toBe("parent v2");
      expect(copy?.edited).toBe(true);
      expect(copy?.reactions?.map((r) => r.name)).toEqual(["tada"]);
    }
  });

  test("deleting a thread parent drops the channel copy and the whole thread", async () => {
    const parent = await threadParent();
    const ts = stamp(parent.ts);
    h.deliver(h.slack.echo(C1, h.slack.say(C1, OTHER, "r1", { threadTs: stamp(parent.ts) })));
    expect(h.thread(ts)).toHaveLength(2);
    h.deliver(h.slack.deleted(C1, stamp(parent.ts)));
    expect(texts(C1)).toEqual([]);
    expect(h.thread(ts)).toEqual([]);
    expect(h.deleted).toEqual([`C1:${parent.ts}`]);
  });

  test("deleting a reply leaves the parent and its siblings alone", async () => {
    const parent = await threadParent();
    const keep = h.slack.say(C1, OTHER, "keep", { threadTs: stamp(parent.ts) });
    const drop = h.slack.say(C1, OTHER, "drop", { threadTs: stamp(parent.ts) });
    h.deliver(h.slack.echo(C1, keep));
    h.deliver(h.slack.echo(C1, drop));
    h.deliver(h.slack.deleted(C1, stamp(drop.ts)));
    expect(h.thread(stamp(parent.ts)).map((m) => m.text)).toEqual(["parent", "keep"]);
    expect(texts(C1)).toEqual(["parent"]);
  });

  test("a delete is idempotent when the event is replayed", () => {
    const message = h.slack.say(C1, OTHER, "gone");
    h.deliver(h.slack.echo(C1, message));
    h.deliver(h.slack.deleted(C1, stamp(message.ts)));
    h.deliver(h.slack.deleted(C1, stamp(message.ts)));
    expect(texts(C1)).toEqual([]);
  });
});

describe("unread flags", () => {
  test("only messages from others in channels nobody is looking at count", () => {
    h.slack.say(C2, OTHER, "seed");
    h.slack.say(C3, OTHER, "seed");
    const parent = h.slack.say(C3, OTHER, "parent");
    h.deliver(h.slack.echo(C1, h.slack.say(C1, OTHER, "visible")));
    h.deliver(h.slack.echo(C2, h.slack.say(C2, ME, "mine")));
    h.deliver(h.slack.echo(C3, h.slack.say(C3, OTHER, "reply", { threadTs: stamp(parent.ts) })));
    expect(h.unreadChannels()).toEqual([]);
    h.deliver(h.slack.echo(C2, h.slack.say(C2, OTHER, "theirs")));
    expect(h.unreadChannels()).toEqual([C2]);
  });
});

describe("reconnecting after downtime", () => {
  const SHORT = 1000;
  const LONG = 30_000;

  test("a blip refetches nothing", async () => {
    h.slack.say(C1, OTHER, "one");
    await h.store.loadRecentHistory(C1);
    h.slack.resetRequests();
    h.onReconnect({ downMs: SHORT });
    await settle();
    expect(h.slack.requests()).toEqual([]);
  });

  test("messages missed while offline show up once, in order", async () => {
    h.slack.say(C1, OTHER, "one");
    await h.store.loadRecentHistory(C1);
    h.slack.say(C1, OTHER, "missed a");
    const missedB = h.slack.say(C1, OTHER, "missed b");
    h.onReconnect({ downMs: LONG });
    h.deliver(h.slack.echo(C1, missedB));
    await settle();
    expect(texts(C1)).toEqual(["one", "missed a", "missed b"]);
  });

  test("a message still sending is not lost or doubled by the catch up", async () => {
    h.slack.say(C1, OTHER, "one");
    await h.store.loadRecentHistory(C1);
    const release = h.slack.holdPosts();
    const sending = h.store.sendMessage(C1, "in flight", []);
    await settle();
    h.onReconnect({ downMs: LONG });
    await settle();
    expect(texts(C1)).toEqual(["one", "in flight"]);
    release();
    await sending;
    await settle();
    expect(texts(C1)).toEqual(["one", "in flight"]);
    expect(h.messages(C1).every((m) => !m.pending)).toBe(true);
  });

  test("a channel nobody watches reloads from scratch when opened again", async () => {
    h.slack.say(C2, OTHER, "old");
    h.open(C1, C2);
    await settle();
    h.open(C1);
    await settle();
    h.onReconnect({ downMs: LONG });
    h.deliver(h.slack.echo(C2, h.slack.say(C2, OTHER, "while away")));
    await settle();
    expect(h.store.loadedChannels.has(C2)).toBe(false);
    expect(texts(C2)).toEqual(["old"]);

    h.open(C1, C2);
    await settle();
    expect(texts(C2)).toEqual(["old", "while away"]);
  });

  test("an open thread picks up replies it missed", async () => {
    const parent = h.slack.say(C1, OTHER, "parent");
    const ts = stamp(parent.ts);
    h.deliver(h.slack.echo(C1, parent));
    h.openThread({ channelId: C1, ts });
    await settle();
    h.slack.say(C1, OTHER, "missed", { threadTs: stamp(parent.ts) });
    h.onReconnect({ downMs: LONG });
    await settle();
    expect(h.thread(ts).map((m) => m.text)).toEqual(["parent", "missed"]);
  });
});

describe("live messages while viewing an old window", () => {
  const BASE = 1_700_000_000;

  test("they stay out of the window and arrive once when scrolled to the present", async () => {
    for (let i = 0; i < 60; i++) h.slack.say(C1, OTHER, `m${i}`, { at: BASE + i });
    await h.store.loadRecentHistory(C1);
    const old = defined(h.slack.serverMessages(C1)[10]);
    expect(await h.store.jumpToTs(C1, stamp(old.ts))).toBe(true);
    expect(h.store.hasNewerHistory(C1)).toBe(true);

    const live = h.slack.say(C1, OTHER, "live");
    h.deliver(h.slack.echo(C1, live));
    expect(texts(C1)).not.toContain("live");

    while (h.store.hasNewerHistory(C1)) await h.store.loadNewerMessages(C1);
    const shown = texts(C1);
    expect(shown.filter((t) => t === "live")).toHaveLength(1);
    expect(shown.at(-1)).toBe("live");
    expect(h.messages(C1).map((m) => Number(m.ts))).toEqual(
      h
        .messages(C1)
        .map((m) => Number(m.ts))
        .sort((a, b) => a - b),
    );
  });
});
