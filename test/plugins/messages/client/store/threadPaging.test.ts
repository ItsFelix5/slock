import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { defined } from "@slock/core";
import type { Ts } from "@slock/types";
import { ch, stamp } from "../../../../support/slack";
import { createStoreHarness, OTHER, type StoreHarness, settle } from "./storeHarness";

const C1 = ch("C1");

let h: StoreHarness;

const BASE = 1_700_000_000;
const REPLIES = 250;
const at = (seconds: number) => stamp(seconds.toFixed(6));

beforeEach(async () => {
  h = await createStoreHarness();
  h.open(C1);
  await settle();
});

afterEach(() => h.dispose());

function longThread(count = REPLIES) {
  const parent = h.slack.say(C1, OTHER, "parent", { at: BASE });
  const ts = stamp(parent.ts);
  h.deliver(h.slack.echo(C1, parent));
  for (let i = 1; i <= count; i++)
    h.slack.say(C1, OTHER, `reply ${i}`, { at: BASE + i, threadTs: ts });
  return ts;
}

async function loadAll(ts: Ts) {
  for (let i = 0; i < 20 && h.store.hasMoreReplies(ts); i++) {
    await h.store.loadMoreReplies(ts);
    await settle();
  }
}

function shortThread() {
  const parent = h.slack.say(C1, OTHER, "parent", { at: BASE });
  const ts = stamp(parent.ts);
  h.deliver(h.slack.echo(C1, parent));
  const replies = [1, 2, 3, 4, 5].map((i) =>
    h.slack.say(C1, OTHER, `reply ${i}`, { at: BASE + i, threadTs: ts }),
  );
  return { replies, ts };
}

describe("thread completeness", () => {
  test("a reply Slack leaves out is reported once and a reload restores it", async () => {
    const { replies, ts } = shortThread();
    h.slack.dropReply(stamp(defined(replies[2]).ts), 1);
    h.openThreads({ channelId: C1, ts });
    await settle();
    expect(h.store.missingReplies(ts)).toBe(1);
    h.slack.resetRequests();
    await settle();
    expect(h.slack.requests()).toEqual([]);
    await h.store.refreshThreadReplies(ts);
    await settle();
    expect(h.thread(ts).map((m) => m.text)).toEqual([
      "parent",
      "reply 1",
      "reply 2",
      "reply 3",
      "reply 4",
      "reply 5",
    ]);
    expect(h.store.missingReplies(ts)).toBe(0);
  });

  test("replies that never arrive are reported instead of hidden", async () => {
    const { replies, ts } = shortThread();
    h.slack.dropReply(stamp(defined(replies[2]).ts), Number.POSITIVE_INFINITY);
    h.openThreads({ channelId: C1, ts });
    await settle();
    expect(h.thread(ts)).toHaveLength(5);
    expect(h.store.missingReplies(ts)).toBe(1);
  });

  test("a complete thread reports nothing missing", async () => {
    const { ts } = shortThread();
    h.openThreads({ channelId: C1, ts });
    await settle();
    expect(h.store.missingReplies(ts)).toBe(0);
  });
});

describe("long thread paging", () => {
  test("first load is partial and says so, paging reaches every reply", async () => {
    const ts = longThread();
    h.openThreads({ channelId: C1, ts });
    await settle();
    expect(h.store.hasMoreReplies(ts)).toBe(true);
    expect(h.store.acceptsLiveReplies(ts)).toBe(false);
    await loadAll(ts);
    expect(h.store.hasMoreReplies(ts)).toBe(false);
    expect(h.thread(ts).map((m) => m.ts)).toEqual([
      ts,
      ...Array.from({ length: REPLIES }, (_, i) => at(BASE + i + 1)),
    ]);
  });

  test("jumping to the latest reply skips the pages in between", async () => {
    const ts = longThread();
    h.openThreads({ channelId: C1, ts });
    await settle();
    await h.store.loadLatestReplies(ts);
    await settle();
    const texts = h.thread(ts).map((m) => m.text);
    expect(texts[0]).toBe("parent");
    expect(texts.at(-1)).toBe(`reply ${REPLIES}`);
    expect(texts).not.toContain("reply 100");
    expect(h.store.hasMoreReplies(ts)).toBe(false);
    expect(h.store.hasEarlierReplies(ts)).toBe(true);
    expect(h.store.loadLatestReplies(ts)).toBeUndefined();
  });

  test("the first page starts at the first reply even when Slack's unranged page does not", async () => {
    const ts = longThread();
    h.openThreads({ channelId: C1, ts });
    await settle();
    const texts = h.thread(ts).map((m) => m.text);
    expect(texts.slice(0, 3)).toEqual(["parent", "reply 1", "reply 2"]);
    expect(texts).not.toContain("reply 125");
  });

  test("a reconnect catch-up mid-paging neither loses nor fakes completeness", async () => {
    const ts = longThread();
    h.openThreads({ channelId: C1, ts });
    await settle();
    await h.store.refreshThreadReplies(ts);
    await settle();
    expect(h.store.hasMoreReplies(ts)).toBe(true);
    await loadAll(ts);
    expect(h.thread(ts)).toHaveLength(REPLIES + 1);
  });

  test("a catch-up racing a page load keeps the furthest cursor", async () => {
    const ts = longThread();
    h.openThreads({ channelId: C1, ts });
    await settle();
    const release = h.slack.holdReplies();
    const more = h.store.loadMoreReplies(ts);
    const catchUp = h.store.refreshThreadReplies(ts);
    await settle();
    release();
    await Promise.all([more, catchUp]);
    await settle();
    await loadAll(ts);
    expect(h.thread(ts)).toHaveLength(REPLIES + 1);
    expect(h.store.hasMoreReplies(ts)).toBe(false);
  });

  test("a live reply landing while the first page loads is kept", async () => {
    const parent = h.slack.say(C1, OTHER, "parent", { at: BASE });
    const ts = stamp(parent.ts);
    h.deliver(h.slack.echo(C1, parent));
    h.slack.say(C1, OTHER, "early", { at: BASE + 1, threadTs: ts });
    const release = h.slack.holdReplies();
    h.openThreads({ channelId: C1, ts });
    await settle();
    const late = h.slack.say(C1, OTHER, "late", { at: BASE + 2, threadTs: ts });
    h.deliver(h.slack.echo(C1, late));
    release();
    await settle();
    expect(h.thread(ts).map((m) => m.text)).toEqual(["parent", "early", "late"]);
  });

  test("a page requested before a jump to a far reply cannot land in the jumped window", async () => {
    const ts = longThread();
    h.openThreads({ channelId: C1, ts });
    await settle();
    const release = h.slack.holdReplies();
    const stale = h.store.loadMoreReplies(ts);
    h.openThreads({ channelId: C1, ts, highlightTs: at(BASE + 240) });
    await settle();
    release();
    await stale;
    await settle();
    const texts = h.thread(ts).map((m) => m.text);
    expect(texts).toContain("reply 240");
    expect(texts).not.toContain("reply 150");
    await loadAll(ts);
    expect(h.thread(ts).at(-1)?.text).toBe(`reply ${REPLIES}`);
  });

  test("a jump issued while the first page loads still lands on its reply", async () => {
    const ts = longThread();
    const release = h.slack.holdReplies();
    h.openThreads({ channelId: C1, ts });
    await settle();
    const highlightTs = at(BASE + 240);
    h.openThreads({ channelId: C1, highlightTs, ts });
    await settle();
    release();
    await settle();
    expect(h.thread(ts).map((m) => m.ts)).toContain(highlightTs);
  });

  test("a page that was in flight when the thread was evicted leaves no ghost state", async () => {
    const ts = longThread();
    const release = h.slack.holdReplies();
    h.openThreads({ channelId: C1, ts });
    await settle();
    for (const other of ["9999999999.000000", "9999999998.000000", "9999999997.000000"])
      h.openThreads({ channelId: C1, ts: stamp(other) });
    h.openThreads({ channelId: C1, ts: stamp("9999999996.000000") });
    await settle();
    release();
    await settle();
    h.openThreads({ channelId: C1, ts });
    await settle();
    expect(h.thread(ts).length).toBeGreaterThan(0);
    expect(h.store.hasMoreReplies(ts)).toBe(true);
  });
});

describe("anchored thread load", () => {
  const replyRequests = () => h.slack.requests().filter((r) => r.includes("/threads/"));

  test("a thread that fits one page loads in one request", async () => {
    const { replies, ts } = shortThread();
    h.slack.resetRequests();
    h.openThreads({ channelId: C1, highlightTs: stamp(defined(replies[4]).ts), ts });
    await settle();
    expect(replyRequests()).toHaveLength(1);
    expect(h.thread(ts)).toHaveLength(6);
  });

  test("the same anchor again makes no request", async () => {
    const { replies, ts } = shortThread();
    const highlightTs = stamp(defined(replies[4]).ts);
    h.openThreads({ channelId: C1, highlightTs, ts });
    await settle();
    h.slack.resetRequests();
    h.openThreads({ channelId: C1, highlightTs, ts });
    await settle();
    expect(replyRequests()).toEqual([]);
  });

  test("an anchor past the first page of a medium thread loads in a few requests", async () => {
    const ts = longThread(70);
    h.slack.resetRequests();
    h.openThreads({ channelId: C1, highlightTs: at(BASE + 65), ts });
    await settle();
    expect(replyRequests().length).toBeLessThanOrEqual(3);
    expect(h.thread(ts).map((m) => m.text)).toContain("reply 65");
    expect(h.thread(ts)[0]?.text).toBe("parent");
  });

  test("a far anchor in a long thread still lands on its reply", async () => {
    const ts = longThread();
    h.slack.resetRequests();
    h.openThreads({ channelId: C1, highlightTs: at(BASE + 240), ts });
    await settle();
    expect(h.thread(ts).map((m) => m.text)).toContain("reply 240");
    expect(h.thread(ts)[0]?.text).toBe("parent");
  });
});
