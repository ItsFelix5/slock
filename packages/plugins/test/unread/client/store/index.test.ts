import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Message } from "@slock/types";
import {
  channel,
  fakeWindow,
  flush,
  harness,
  message,
  mount,
  unmountAll,
} from "../../../../src/unread/client/store/unreadTestKit";

let browser: ReturnType<typeof fakeWindow>;
let errors: ReturnType<typeof spyOn>;
beforeEach(() => {
  browser = fakeWindow();
  errors = spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  unmountAll();
  browser.restore();
  errors.mockRestore();
});

describe("bootstrap seeding", () => {
  test("seeds unread flags and last read cursors once", () => {
    const { setBootstrap, store } = mount(() =>
      harness({
        channels: [channel("C1", true), channel("C2")],
        directMessages: [{ id: "D1", unread: true }],
        lastReadByChannel: { C1: 1000 },
      }),
    );
    expect(store.isChannelUnread("C1")).toBe(true);
    expect(store.isChannelUnread("C2")).toBe(false);
    expect(store.isChannelUnread("D1")).toBe(true);
    expect(store.lastReadFor("C1")).toBe(1000);
    setBootstrap({
      channels: [channel("C2", true)],
      directMessages: [],
      lastReadByChannel: { C1: 5 },
    });
    expect(store.isChannelUnread("C2")).toBe(false);
    expect(store.lastReadFor("C1")).toBe(1000);
  });

  test("seeds when bootstrap arrives after setup", () => {
    const { setBootstrap, store } = mount(() => harness());
    expect(store.isChannelUnread("C1")).toBe(false);
    setBootstrap({ channels: [channel("C1", true)], directMessages: [], lastReadByChannel: {} });
    expect(store.isChannelUnread("C1")).toBe(true);
  });

  test("waits for counts before seeding", () => {
    const { setBootstrap, store } = mount(() => harness());
    setBootstrap({
      channels: [channel("C1")],
      countsLoaded: false,
      directMessages: [],
      lastReadByChannel: {},
    });
    setBootstrap({
      channels: [channel("C1", true)],
      countsLoaded: true,
      directMessages: [],
      lastReadByChannel: { C1: 7 },
    });
    expect(store.isChannelUnread("C1")).toBe(true);
    expect(store.lastReadFor("C1")).toBe(7);
  });
});

describe("setThreadRead", () => {
  test("keeps the cursor after a successful sync", async () => {
    const { store, threadReads } = mount(() => harness());
    expect(await store.setThreadRead("C1", "1.1", "2.2")).toBe(true);
    expect(store.threadReadTsFor("1.1")).toBe("2.2");
    expect(threadReads).toEqual([["C1", "1.1", "2.2"]]);
  });

  test("shows the cursor immediately while the write is in flight", async () => {
    const { store } = mount(() => harness());
    const pending = store.setThreadRead("C1", "1.1", "2.2");
    expect(store.threadReadTsFor("1.1")).toBe("2.2");
    await pending;
  });

  test("keeps the cursor when the thread was deleted", async () => {
    const { failure, flashes, store } = mount(() => harness());
    failure.error = new Error("message_not_found");
    expect(await store.setThreadRead("C1", "1.1", "2.2")).toBe(true);
    expect(store.threadReadTsFor("1.1")).toBe("2.2");
    expect(flashes).toEqual([]);
  });

  test("restores the previous cursor and flashes when the write fails", async () => {
    const { failure, flashes, store } = mount(() => harness());
    await store.setThreadRead("C1", "1.1", "2.2");
    failure.error = new Error("ratelimited");
    expect(await store.setThreadRead("C1", "1.1", "3.3")).toBe(false);
    expect(store.threadReadTsFor("1.1")).toBe("2.2");
    expect(flashes).toEqual(["Couldn't sync thread read state."]);
  });

  test("a failed first write leaves no cursor behind", async () => {
    const { failure, store } = mount(() => harness());
    failure.error = new Error("ratelimited");
    await store.setThreadRead("C1", "1.1", "2.2");
    expect(store.threadReadTsFor("1.1")).toBeUndefined();
  });
});

describe("isThreadUnread", () => {
  const root = (extra: Partial<Message>) =>
    message("1.1", { isSubscribed: true, latestReply: "5.5", ...extra });

  test.each([
    ["a newer reply than the root", root({}), true],
    ["no replies", root({ latestReply: undefined }), false],
    ["not subscribed", root({ isSubscribed: false }), false],
    ["server read cursor at the latest reply", root({ threadLastRead: "5.5" }), false],
    ["server read cursor before the latest reply", root({ threadLastRead: "3.3" }), true],
  ])("%s", (_name, thread, expected) => {
    expect(mount(() => harness()).store.isThreadUnread(thread)).toBe(expected);
  });

  test("a local cursor beats the server cursor", () => {
    const { store } = mount(() => harness());
    const thread = root({ threadLastRead: "1.1" });
    expect(store.isThreadUnread(thread)).toBe(true);
    store.setThreadReadTs("1.1", "5.5");
    expect(store.isThreadUnread(thread)).toBe(false);
  });
});

describe("window activity", () => {
  test("viewed needs a focused window and a seen bottom", () => {
    browser.setFocused(false);
    const { store } = mount(() => harness());
    store.setBottomSeen("C1", true);
    expect(store.isViewed("C1")).toBe(false);
    browser.setFocused(true);
    expect(store.isViewed("C1")).toBe(true);
    browser.setFocused(false);
    expect(store.isViewed("C1")).toBe(false);
  });

  test("every listener is removed on dispose", () => {
    mount(() => harness());
    expect(browser.listenerCount()).toBe(3);
    unmountAll();
    expect(browser.listenerCount()).toBe(0);
  });
});

describe("count refresh", () => {
  test("only reads that clear unread ask for fresh counts", async () => {
    const { countRefreshes, store } = mount(() =>
      harness({
        channels: [channel("C1", true), channel("C2")],
        directMessages: [],
        lastReadByChannel: {},
      }),
    );
    void store.syncChannelRead("C2", "1.000000");
    await flush();
    expect(countRefreshes()).toBe(0);
    void store.syncChannelRead("C1", "1.000000");
    await flush();
    expect(countRefreshes()).toBe(1);
  });
});
