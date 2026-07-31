// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import type { HistoryPage, Message } from "@slock/slack-api";
import { createMessageHistory } from "../messageHistory";

function message(ts: string): Message {
  return {
    day: "Today",
    id: ts,
    kind: "normal",
    text: ts,
    time: "12:00",
    ts,
    userId: "U1",
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const emptyDeps = {
  activeThread: () => null,
  activeView: () => null,
};

describe("createMessageHistory", () => {
  test("ignores a stale recent window after a permalink window wins", async () => {
    const recent = deferred<HistoryPage>();
    const around = deferred<HistoryPage>();
    const history = createMessageHistory(emptyDeps, {
      fetchHistory: () => recent.promise,
      fetchHistoryAround: () => around.promise,
      fetchReplies: () => Promise.resolve([]),
    });

    const recentRequest = history.loadRecentHistory("C1");
    const permalinkRequest = history.ensureChannelMessage("C1", "10.0");
    around.resolve({ hasMore: true, messages: [message("10.0")], nextCursor: "older" });
    expect(await permalinkRequest).toBe(true);
    recent.resolve({ hasMore: false, messages: [message("99.0")] });
    await recentRequest;

    expect(history.messagesByChannel.C1.map((item) => item.ts)).toEqual(["10.0"]);
    expect(history.historyMeta.C1.anchored).toBe(true);
  });

  test("exposes an older-page failure and allows an explicit retry", async () => {
    let calls = 0;
    const history = createMessageHistory(emptyDeps, {
      fetchHistory: () => {
        calls++;
        if (calls === 1) {
          return Promise.resolve({
            hasMore: true,
            messages: [message("3.0")],
            nextCursor: "older",
          });
        }
        if (calls === 2) return Promise.reject(new Error("offline"));
        return Promise.resolve({ hasMore: false, messages: [message("2.0")] });
      },
      fetchHistoryAround: () => Promise.resolve({ hasMore: false, messages: [] }),
      fetchReplies: () => Promise.resolve([]),
    });

    await history.loadRecentHistory("C1");
    await history.loadOlderMessages("C1");
    expect(history.hasOlderHistoryError("C1")).toBe(true);

    await history.loadOlderMessages("C1");
    expect(history.hasOlderHistoryError("C1")).toBe(false);
    expect(history.messagesByChannel.C1.map((item) => item.ts)).toEqual(["2.0", "3.0"]);
  });
});
