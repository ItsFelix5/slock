import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { defined } from "@slock/core";
import type { Ts } from "@slock/types";
import { ch, stamp } from "../../../../support/slack";
import { createStoreHarness, OTHER, type StoreHarness, settle } from "./storeHarness";

const C1 = ch("C1");
const BASE = 1_700_000_000;

let h: StoreHarness;

beforeEach(async () => {
  h = await createStoreHarness();
  h.open(C1);
  await settle();
});

afterEach(() => h.dispose());

const texts = (ts: Ts) => h.thread(ts).map((m) => m.text);

async function openThread(count: number) {
  const parent = h.slack.say(C1, OTHER, "parent", { at: BASE });
  const ts = stamp(parent.ts);
  h.deliver(h.slack.echo(C1, parent));
  const replies = Array.from({ length: count }, (_, i) =>
    h.slack.say(C1, OTHER, `reply ${i + 1}`, { at: BASE + i + 1, threadTs: ts }),
  );
  h.openThreads({ channelId: C1, ts });
  await settle();
  return { replies, ts };
}

function changeWhileOffline(ts: Ts, edited: Ts, removed: Ts) {
  h.slack.edit(C1, edited, "edited");
  h.slack.remove(C1, removed);
  h.slack.say(C1, OTHER, "missed", { threadTs: ts });
}

describe("threads after a reconnect", () => {
  test("an open thread shows missed replies, edits and deletes", async () => {
    const { replies, ts } = await openThread(3);
    changeWhileOffline(ts, stamp(defined(replies[0]).ts), stamp(defined(replies[1]).ts));
    h.onReconnect();
    await settle();
    expect(texts(ts)).toEqual(["parent", "edited", "reply 3", "missed"]);
  });

  test("a cached thread catches up when opened again", async () => {
    const { replies, ts } = await openThread(3);
    h.openThreads();
    await settle();
    changeWhileOffline(ts, stamp(defined(replies[0]).ts), stamp(defined(replies[2]).ts));
    h.slack.resetRequests();
    h.onReconnect();
    await settle();
    expect(h.slack.requests().filter((r) => r.includes("/threads/"))).toEqual([]);
    h.openThreads({ channelId: C1, ts });
    await settle();
    expect(texts(ts)).toEqual(["parent", "edited", "reply 2", "missed"]);
  });

  test("a load stuck on the dead connection does not block the new one", async () => {
    const parent = h.slack.say(C1, OTHER, "parent", { at: BASE });
    const ts = stamp(parent.ts);
    const release = h.slack.holdReplies();
    h.openThreads({ channelId: C1, ts });
    await settle();
    h.slack.say(C1, OTHER, "missed", { threadTs: ts });
    h.onReconnect();
    release();
    await settle();
    expect(texts(ts)).toEqual(["parent", "missed"]);
    expect(h.store.isLoadingThread(ts)).toBe(false);
  });

  test("a long thread keeps every loaded page", async () => {
    const { replies, ts } = await openThread(250);
    await h.store.loadMoreReplies(ts);
    await settle();
    const loaded = h.thread(ts).length;
    h.slack.edit(C1, stamp(defined(replies[120]).ts), "edited");
    h.slack.remove(C1, stamp(defined(replies[10]).ts));
    h.onReconnect();
    await settle();
    expect(h.thread(ts).length).toBeGreaterThanOrEqual(loaded - 1);
    expect(texts(ts)).toContain("edited");
    expect(texts(ts)).not.toContain("reply 11");
  });

  test("a window jumped deep into a thread stays there", async () => {
    const { ts } = await openThread(250);
    await h.store.loadLatestReplies(ts);
    await settle();
    const first = h.thread(ts)[1]?.ts;
    h.slack.say(C1, OTHER, "missed", { at: BASE + 400, threadTs: ts });
    h.onReconnect();
    await settle();
    expect(h.thread(ts)[1]?.ts).toBe(first);
    expect(texts(ts)[0]).toBe("parent");
    expect(texts(ts).at(-1)).toBe("missed");
  });
});
