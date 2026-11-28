import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { defined } from "@slock/core";
import type { ChannelId, Ts } from "@slock/types";
import { forAll, int, pick } from "../../../../support/core";
import { ch, stamp } from "../../../../support/slack";
import { createStoreHarness, OTHER, type StoreHarness, settle } from "./storeHarness";

const C1 = ch("C1");

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
    h.openThreads({ channelId: C1, ts });
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

  test("a deleted reply leaves the thread complete, even if the delete event repeats", async () => {
    const parent = h.slack.say(C1, OTHER, "parent");
    const ts = stamp(parent.ts);
    h.deliver(h.slack.echo(C1, parent));
    h.openThreads({ channelId: C1, ts });
    await settle();
    const first = h.slack.say(C1, OTHER, "r1", { threadTs: ts });
    const second = h.slack.say(C1, OTHER, "r2", { threadTs: ts });
    for (const reply of [first, second]) {
      h.deliver(h.slack.echo(C1, reply));
      h.deliver(h.slack.replied(C1, ts));
    }
    h.deliver(h.slack.deleted(C1, stamp(first.ts)));
    h.deliver(h.slack.deleted(C1, stamp(first.ts)));
    expect(find(C1, ts)?.replyCount).toBe(1);
    expect(h.thread(ts).map((m) => m.text)).toEqual(["parent", "r2"]);
    expect(h.store.missingReplies(ts)).toBe(0);
  });

  test("replies reach an open thread but never the channel list", async () => {
    const parent = h.slack.say(C1, OTHER, "parent");
    const ts = stamp(parent.ts);
    h.deliver(h.slack.echo(C1, parent));
    h.openThreads({ channelId: C1, ts });
    await settle();
    h.deliver(h.slack.echo(C1, h.slack.say(C1, OTHER, "r1", { threadTs: stamp(parent.ts) })));
    expect(texts(C1)).toEqual(["parent"]);
    expect(h.thread(ts).map((m) => m.text)).toEqual(["parent", "r1"]);
  });

  test("a broadcast reply shows in both places and survives an edit", async () => {
    const parent = h.slack.say(C1, OTHER, "parent");
    const ts = stamp(parent.ts);
    h.deliver(h.slack.echo(C1, parent));
    h.openThreads({ channelId: C1, ts });
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
