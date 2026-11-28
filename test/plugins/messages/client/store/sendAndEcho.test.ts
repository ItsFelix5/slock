import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { defined } from "@slock/core";
import type { ChannelId } from "@slock/types";
import { ch, stamp } from "../../../../support/slack";
import { createStoreHarness, ME, OTHER, type StoreHarness, settle } from "./storeHarness";

const C1 = ch("C1");
const C2 = ch("C2");

let h: StoreHarness;

beforeEach(async () => {
  h = await createStoreHarness();
  h.open(C1);
  await settle();
});

afterEach(() => h.dispose());

const texts = (channel: ChannelId) => h.messages(channel).map((m) => m.text);
const pending = (channel: ChannelId) => h.messages(channel).filter((m) => m.pending);

describe("sending while the realtime echo races the HTTP reply", () => {
  test("echo before the POST resolves leaves one confirmed message", async () => {
    const release = h.slack.holdPosts();
    const sending = h.store.sendMessage(C1, "hello", []);
    await settle();
    expect(pending(C1)).toHaveLength(1);

    h.deliver(h.slack.echo(C1, h.slack.say(C1, ME, "hello")));
    expect(pending(C1)).toHaveLength(0);

    release();
    await sending;
    expect(texts(C1)).toEqual(["hello"]);
    expect(pending(C1)).toHaveLength(0);
  });

  test("echo after the POST resolves does not duplicate", async () => {
    await h.store.sendMessage(C1, "hello", []);
    const raw = defined(h.slack.findPosted(C1, "hello"));
    expect(texts(C1)).toEqual(["hello"]);
    h.deliver(h.slack.echo(C1, raw));
    h.deliver(h.slack.echo(C1, raw));
    expect(texts(C1)).toEqual(["hello"]);
  });

  test("a failed send removes only its own optimistic message", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    h.slack.failNextPosts(1);
    const release = h.slack.holdPosts();
    const failing = h.store.sendMessage(C1, "doomed", []);
    const failed = failing.catch((err: Error) => err.message);
    await settle();
    h.deliver(h.slack.echo(C1, h.slack.say(C1, OTHER, "someone else")));
    release();
    expect(await failed).toBe("ratelimited");
    expect(texts(C1)).toEqual(["someone else"]);
    error.mockRestore();
  });

  test("two sends in the same millisecond each get their own confirmation", async () => {
    const release = h.slack.holdPosts();
    const first = h.store.sendMessage(C1, "lol", []);
    const second = h.store.sendMessage(C1, "lol", []);
    await settle();
    expect(pending(C1)).toHaveLength(2);
    release();
    await Promise.all([first, second]);
    expect(texts(C1)).toEqual(["lol", "lol"]);
    expect(pending(C1)).toHaveLength(0);
    expect(new Set(h.messages(C1).map((m) => m.ts)).size).toBe(2);
  });

  test("a reply to a thread appears in the thread and not in the channel", async () => {
    const parent = h.slack.say(C1, OTHER, "question");
    const ts = stamp(parent.ts);
    h.deliver(h.slack.echo(C1, parent));
    h.openThreads({ channelId: C1, ts });
    await settle();
    await h.store.sendMessage(C1, "answer", [], ts);
    expect(texts(C1)).toEqual(["question"]);
    expect(h.thread(ts).map((m) => m.text)).toEqual(["question", "answer"]);
  });
});

describe("live events against an in flight history load", () => {
  test("a message that arrives while history loads survives the page", async () => {
    h.slack.say(C2, OTHER, "old");
    const release = h.slack.holdHistory();
    h.open(C1, C2);
    await settle();
    h.deliver(h.slack.echo(C2, h.slack.say(C2, OTHER, "live")));
    release();
    await settle();
    expect(texts(C2)).toEqual(["old", "live"]);
  });

  test("a message deleted while history loads is not resurrected by the page", async () => {
    const doomed = h.slack.say(C2, OTHER, "doomed");
    h.slack.say(C2, OTHER, "kept");
    h.open(C1, C2);
    await settle();
    expect(texts(C2)).toEqual(["doomed", "kept"]);

    const release = h.slack.holdHistory();
    h.store.loadRecentHistory(C2);
    await settle();
    h.slack.remove(C2, stamp(doomed.ts));
    h.deliver(h.slack.deleted(C2, stamp(doomed.ts)));
    expect(texts(C2)).toEqual(["kept"]);
    release();
    await settle();
    expect(texts(C2)).toEqual(["kept"]);
  });
});
