import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { forAll, int, pick } from "@slock/core/testing";
import type { RawMessage } from "@slock/types";
import { createLogStore, type LogStore } from "../../../src/message-logger/server/store";

const DAY_MS = 24 * 60 * 60 * 1000;

let store: LogStore;

beforeEach(() => {
  store = createLogStore(":memory:");
});

afterEach(() => {
  setSystemTime();
  store.close();
});

function message(ts: string, extra: Partial<RawMessage> = {}): RawMessage {
  return { text: `text ${ts}`, ts, user: "U1", ...extra };
}

function tsOf(seconds: number) {
  return `${1_700_000_000 + seconds}.000100`;
}

describe("messages", () => {
  test("returns saved messages in ts order marked as deleted", () => {
    store.saveMessage("T1", "C1", message(tsOf(3)));
    store.saveMessage("T1", "C1", message(tsOf(1)));
    store.saveMessage("T1", "C1", message(tsOf(2)));
    const kept = store.channelMessages("T1", "C1", {});
    expect(kept.map((m) => m.ts)).toEqual([tsOf(1), tsOf(2), tsOf(3)]);
    expect(kept.every((m) => m.deleted)).toBe(true);
  });

  test("saving the same message twice keeps one copy", () => {
    expect(store.saveMessage("T1", "C1", message(tsOf(1)))).toBe(true);
    expect(store.saveMessage("T1", "C1", message(tsOf(1), { text: "other" }))).toBe(false);
    const kept = store.channelMessages("T1", "C1", {});
    expect(kept).toHaveLength(1);
    expect(kept[0]?.text).toBe(`text ${tsOf(1)}`);
  });

  test("thread replies stay out of channel history but broadcasts stay in", () => {
    const root = tsOf(1);
    store.saveMessage("T1", "C1", message(root, { thread_ts: root }));
    store.saveMessage("T1", "C1", message(tsOf(2), { thread_ts: root }));
    store.saveMessage(
      "T1",
      "C1",
      message(tsOf(3), { subtype: "thread_broadcast", thread_ts: root }),
    );
    expect(store.channelMessages("T1", "C1", {}).map((m) => m.ts)).toEqual([root, tsOf(3)]);
    expect(store.threadMessages("T1", "C1", root, {}).map((m) => m.ts)).toEqual([
      root,
      tsOf(2),
      tsOf(3),
    ]);
  });

  test("ranges include both ends", () => {
    for (const s of [1, 2, 3, 4]) store.saveMessage("T1", "C1", message(tsOf(s)));
    const kept = store.channelMessages("T1", "C1", { max: tsOf(3), min: tsOf(2) });
    expect(kept.map((m) => m.ts)).toEqual([tsOf(2), tsOf(3)]);
  });

  test("keeps unicode and emoji text intact", () => {
    const text = "héllo 😀 שלום <@U2> ```code```";
    store.saveMessage("T1", "C1", message(tsOf(1), { text }));
    expect(store.channelMessages("T1", "C1", {})[0]?.text).toBe(text);
  });
});

describe("tenant isolation", () => {
  test("one workspace never sees another workspace's deleted messages", () => {
    store.saveMessage("T1", "C1", message(tsOf(1), { text: "secret of T1" }));
    store.saveMessage("T2", "C1", message(tsOf(1), { text: "secret of T2" }));
    expect(store.channelMessages("T1", "C1", {}).map((m) => m.text)).toEqual(["secret of T1"]);
    expect(store.channelMessages("T2", "C1", {}).map((m) => m.text)).toEqual(["secret of T2"]);
    expect(store.channelMessages("T3", "C1", {})).toEqual([]);
  });

  test("channels and threads are separate keys", () => {
    store.saveMessage("T1", "C1", message(tsOf(2), { thread_ts: tsOf(1) }));
    expect(store.channelMessages("T1", "C2", {})).toEqual([]);
    expect(store.threadMessages("T1", "C2", tsOf(1), {})).toEqual([]);
    expect(store.threadMessages("T2", "C1", tsOf(1), {})).toEqual([]);
  });

  test("workspace ids that look like wildcards match nothing extra", () => {
    store.saveMessage("T1", "C1", message(tsOf(1)));
    expect(store.channelMessages("%", "C1", {})).toEqual([]);
    expect(store.channelMessages("T1' or '1'='1", "C1", {})).toEqual([]);
  });

  test("kept files are scoped to their owner", () => {
    store.saveBlob("alice", "https://files.slack.com/a", "image/png", new Uint8Array([1, 2, 3]));
    expect(store.hasBlob("alice", "https://files.slack.com/a")).toBe(true);
    expect(store.hasBlob("bob", "https://files.slack.com/a")).toBe(false);
    expect(store.blob("bob", "https://files.slack.com/a")).toBeNull();
    expect([...(store.blob("alice", "https://files.slack.com/a")?.bytes ?? [])]).toEqual([1, 2, 3]);
  });

  test("two owners can keep the same url with different bytes", () => {
    store.saveBlob("alice", "u", "image/png", new Uint8Array([1]));
    store.saveBlob("bob", "u", "image/png", new Uint8Array([2]));
    expect([...(store.blob("alice", "u")?.bytes ?? [])]).toEqual([1]);
    expect([...(store.blob("bob", "u")?.bytes ?? [])]).toEqual([2]);
  });
});

describe("purge", () => {
  test("drops messages and files older than 30 days and keeps newer ones", () => {
    const start = Date.parse("2026-01-01T00:00:00Z");
    setSystemTime(start);
    store.saveMessage("T1", "C1", message(tsOf(1)));
    store.saveBlob("alice", "old", "image/png", new Uint8Array([1]));
    setSystemTime(start + 20 * DAY_MS);
    store.saveMessage("T1", "C1", message(tsOf(2)));
    store.saveBlob("alice", "new", "image/png", new Uint8Array([2]));
    setSystemTime(start + 31 * DAY_MS);
    store.purge();
    expect(store.channelMessages("T1", "C1", {}).map((m) => m.ts)).toEqual([tsOf(2)]);
    expect(store.hasBlob("alice", "old")).toBe(false);
    expect(store.hasBlob("alice", "new")).toBe(true);
  });

  test("keeps everything exactly at the 30 day boundary", () => {
    const start = Date.parse("2026-01-01T00:00:00Z");
    setSystemTime(start);
    store.saveMessage("T1", "C1", message(tsOf(1)));
    setSystemTime(start + 30 * DAY_MS);
    store.purge();
    expect(store.channelMessages("T1", "C1", {})).toHaveLength(1);
    setSystemTime(start + 30 * DAY_MS + 1);
    store.purge();
    expect(store.channelMessages("T1", "C1", {})).toEqual([]);
  });

  test("a purged message can be saved again", () => {
    const start = Date.parse("2026-01-01T00:00:00Z");
    setSystemTime(start);
    store.saveMessage("T1", "C1", message(tsOf(1)));
    setSystemTime(start + 40 * DAY_MS);
    store.purge();
    expect(store.saveMessage("T1", "C1", message(tsOf(1)))).toBe(true);
  });
});

describe("concurrent writes", () => {
  test("interleaved saves from many callers keep one row per message", async () => {
    const writes = Array.from({ length: 300 }, (_, i) =>
      Promise.resolve().then(() => store.saveMessage("T1", "C1", message(tsOf(i % 100)))),
    );
    const results = await Promise.all(writes);
    expect(results.filter(Boolean)).toHaveLength(100);
    expect(store.channelMessages("T1", "C1", {})).toHaveLength(100);
  });

  test("reads return ts ordered unique rows for any insert order", () => {
    forAll(
      (random) =>
        Array.from({ length: int(random, 0, 40) }, () => ({
          channel: pick(random, ["C1", "C2"]),
          second: int(random, 0, 15),
          workspace: pick(random, ["T1", "T2"]),
        })),
      (writes) => {
        const fresh = createLogStore(":memory:");
        for (const w of writes) fresh.saveMessage(w.workspace, w.channel, message(tsOf(w.second)));
        for (const workspace of ["T1", "T2"]) {
          for (const channel of ["C1", "C2"]) {
            const expected = new Set(
              writes
                .filter((w) => w.workspace === workspace && w.channel === channel)
                .map((w) => tsOf(w.second)),
            );
            const got = fresh.channelMessages(workspace, channel, {}).map((m) => m.ts);
            expect(got).toEqual([...expected].sort());
          }
        }
        fresh.close();
      },
      100,
    );
  });
});
