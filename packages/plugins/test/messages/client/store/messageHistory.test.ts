import { describe, expect, test } from "bun:test";
import { int, pick, seededRandom } from "@slock/core/testing";
import type { HistoryPage, Message } from "@slock/types";
import { createRoot } from "solid-js";
import { unwrap } from "solid-js/store";
import { message, slackTs } from "../../../../src/messages/client/messageFixture";
import { createMessageHistory } from "../../../../src/messages/client/store/messageHistory";

const CHANNEL = "C1";
const BASE_SECONDS = 1_700_000_000;
const PAGE = 30;
const NEWER_PAGE = 50;
const AROUND = 28;
const WINDOW_CAP = 120;

function createServer(count: number) {
  const all: Message[] = [];
  const positions = new Map<string, number>();
  const append = () => {
    const next = message(slackTs(BASE_SECONDS + all.length));
    positions.set(next.ts, all.length);
    all.push(next);
    return next;
  };
  for (let i = 0; i < count; i++) append();
  const indexOf = (ts: string) => positions.get(ts) ?? -1;
  const countUpTo = (ts: string) => all.filter((m) => parseFloat(m.ts) <= parseFloat(ts)).length;
  const olderPage = (end: number): HistoryPage => {
    const start = Math.max(0, end - PAGE);
    return {
      hasMore: start > 0,
      messages: all.slice(start, end),
      nextCursor: start > 0 ? `before:${all[start]?.ts}` : undefined,
    };
  };
  const api = {
    fetchChannelDetails: () =>
      Promise.resolve({
        archived: false,
        created: BASE_SECONDS,
        id: CHANNEL,
        name: "general",
        private: false,
        purpose: "",
        topic: "",
      }),
    fetchConversationView: () => Promise.reject(new Error("no view")),
    fetchHistory: (_channelId: string, cursor?: string) =>
      Promise.resolve(olderPage(cursor ? indexOf(cursor.slice("before:".length)) : all.length)),
    fetchHistoryAround: (_channelId: string, ts: string) => {
      const end = countUpTo(ts);
      const start = Math.max(0, end - AROUND);
      return Promise.resolve({
        hasMore: start > 0,
        messages: all.slice(start, end),
        nextCursor: start > 0 ? `before:${all[start]?.ts}` : undefined,
      });
    },
    fetchHistoryNewer: (_channelId: string, oldest: string) => {
      const start = countUpTo(oldest);
      const messages = all.slice(start, start + NEWER_PAGE);
      const hasMore = start + NEWER_PAGE < all.length;
      return Promise.resolve({
        hasMore,
        messages,
        nextCursor: hasMore ? messages.at(-1)?.ts : undefined,
      });
    },
  };
  return { all, api, append, indexOf };
}

function createHarness(serverSize: number) {
  const server = createServer(serverSize);
  return createRoot((dispose) => {
    const history = createMessageHistory(
      { visibleMessageTargets: () => [], visibleThreads: () => [], visibleViews: () => [] },
      server.api,
    );
    const window = () => [...unwrap(history.messagesByChannel[CHANNEL] ?? [])];
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    return { dispose, flush, history, server, window };
  });
}

function expectHealthyWindow(
  window: Message[],
  server: ReturnType<typeof createServer>,
  trace: string[],
) {
  const positions = window.map((m) => server.indexOf(m.ts));
  const firstBroken = positions.findIndex(
    (position, i) => position < 0 || (i > 0 && position !== (positions[i - 1] ?? 0) + 1),
  );
  expect(
    { broken: firstBroken, oversize: window.length > WINDOW_CAP },
    `after ${trace.join(", ")}`,
  ).toEqual({ broken: -1, oversize: false });
}

describe("history paging", () => {
  test("loads the latest page first", async () => {
    const { dispose, history, server, window } = createHarness(100);
    await history.loadRecentHistory(CHANNEL);
    expect(window().map((m) => m.ts)).toEqual(server.all.slice(-PAGE).map((m) => m.ts));
    expect(history.hasMoreHistory(CHANNEL)).toBe(true);
    expect(history.hasNewerHistory(CHANNEL)).toBe(false);
    dispose();
  });

  test("paging older reaches the beginning", async () => {
    const { dispose, history, window } = createHarness(70);
    await history.loadRecentHistory(CHANNEL);
    await history.loadOlderMessages(CHANNEL);
    await history.loadOlderMessages(CHANNEL);
    expect(window()).toHaveLength(70);
    expect(history.hasMoreHistory(CHANNEL)).toBe(false);
    dispose();
  });

  test("older paging past the cap trims the newest end and marks newer history", async () => {
    const { dispose, history, window } = createHarness(1000);
    await history.loadRecentHistory(CHANNEL);
    for (let i = 0; i < 12; i++) await history.loadOlderMessages(CHANNEL);
    expect(window()).toHaveLength(WINDOW_CAP);
    expect(history.hasNewerHistory(CHANNEL)).toBe(true);
    dispose();
  });

  test("a message link loads 28 messages ending at the target and then newer ones", async () => {
    const { dispose, flush, history, server, window } = createHarness(500);
    const target = server.all[100]?.ts ?? "";
    await history.ensureChannelMessage(CHANNEL, target);
    await flush();
    expect(window().some((m) => m.ts === target)).toBe(true);
    expect(window()[0]?.ts).toBe(server.all[100 - (AROUND - 1)]?.ts);
    expect(history.hasNewerHistory(CHANNEL)).toBe(true);
    dispose();
  });

  test("newer paging from a window ends at the present", async () => {
    const { dispose, flush, history, server, window } = createHarness(160);
    await history.ensureChannelMessage(CHANNEL, server.all[50]?.ts ?? "");
    await flush();
    for (let i = 0; i < 5; i++) await history.loadNewerMessages(CHANNEL);
    expect(window().at(-1)?.ts).toBe(server.all.at(-1)?.ts);
    expect(history.hasNewerHistory(CHANNEL)).toBe(false);
    dispose();
  });

  test("a failed fetch keeps the window and flags the error", async () => {
    const { dispose, history, server, window } = createHarness(100);
    await history.loadRecentHistory(CHANNEL);
    const before = window();
    server.api.fetchHistory = () => Promise.reject(new Error("offline"));
    await history.loadOlderMessages(CHANNEL);
    expect(history.hasOlderHistoryError(CHANNEL)).toBe(true);
    expect(window()).toEqual(before);
    dispose();
  });
});

describe("history window properties", () => {
  const operations = ["older", "newer", "recent", "jump", "ensure", "post", "date"] as const;

  test("any sequence keeps the window capped, contiguous, ordered and unique", async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const random = seededRandom(seed);
      const { dispose, flush, history, server, window } = createHarness(int(random, 1, 900));
      const trace: string[] = [`seed ${seed}`];
      await history.loadRecentHistory(CHANNEL);
      for (let step = 0; step < 14; step++) {
        const operation = pick(random, operations);
        const target = server.all[int(random, 0, server.all.length - 1)]?.ts ?? "";
        trace.push(operation);
        if (operation === "older") await history.loadOlderMessages(CHANNEL);
        else if (operation === "newer") await history.loadNewerMessages(CHANNEL);
        else if (operation === "recent") await history.loadRecentHistory(CHANNEL);
        else if (operation === "jump") await history.jumpToTs(CHANNEL, target);
        else if (operation === "ensure") await history.ensureChannelMessage(CHANNEL, target);
        else if (operation === "date")
          await history.jumpToDate(CHANNEL, (BASE_SECONDS + int(random, 0, 900)) * 1000);
        else {
          const posted = server.append();
          if (!history.hasNewerHistory(CHANNEL))
            history.setMessagesByChannel(CHANNEL, (existing = []) => [...existing, posted]);
        }
        await flush();
        expectHealthyWindow(window(), server, trace);
      }
      dispose();
    }
  }, 30_000);
});
