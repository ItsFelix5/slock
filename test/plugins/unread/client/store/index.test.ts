import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Channel, Message } from "@slock/types";
import { createSignal, flush as flushSolid } from "solid-js";
import { startQueryHost } from "../../../../support/queryHost";
import { ch, stamp } from "../../../../support/slack";
import { channel, dm, fakeWindow, harness, message, mount, unmountAll } from "./unreadTestKit";

let browser: ReturnType<typeof fakeWindow>;
let errors: ReturnType<typeof spyOn>;
beforeEach(async () => {
  await startQueryHost();
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
        directMessages: [dm("D1", true)],
        lastReadByChannel: { C1: 1000 },
      }),
    );
    expect(store.isChannelUnread(ch("C1"))).toBe(true);
    expect(store.isChannelUnread(ch("C2"))).toBe(false);
    expect(store.isChannelUnread(ch("D1"))).toBe(true);
    expect(store.lastReadFor(ch("C1"))).toBe(1000);
    setBootstrap({
      channels: [channel("C2", true)],
      directMessages: [],
      lastReadByChannel: { C1: 5 },
    });
    flushSolid();
    expect(store.isChannelUnread(ch("C2"))).toBe(false);
    expect(store.lastReadFor(ch("C1"))).toBe(1000);
  });

  test("seeds when bootstrap arrives after setup", () => {
    const { setBootstrap, store } = mount(() => harness());
    expect(store.isChannelUnread(ch("C1"))).toBe(false);
    setBootstrap({ channels: [channel("C1", true)], directMessages: [], lastReadByChannel: {} });
    flushSolid();
    expect(store.isChannelUnread(ch("C1"))).toBe(true);
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
    flushSolid();
    expect(store.isChannelUnread(ch("C1"))).toBe(true);
    expect(store.lastReadFor(ch("C1"))).toBe(7);
  });
});

describe("setThreadRead", () => {
  test("keeps the cursor after a successful sync", async () => {
    const { store, threadReads } = mount(() => harness());
    expect(await store.setThreadRead(ch("C1"), stamp("1.1"), stamp("2.2"))).toBe(true);
    expect(store.threadReadTsFor(stamp("1.1"))).toBe(stamp("2.2"));
    expect(threadReads).toEqual([["C1", "1.1", "2.2"]]);
  });

  test("shows the cursor immediately while the write is in flight", async () => {
    const { store } = mount(() => harness());
    const pending = store.setThreadRead(ch("C1"), stamp("1.1"), stamp("2.2"));
    flushSolid();
    expect(store.threadReadTsFor(stamp("1.1"))).toBe(stamp("2.2"));
    await pending;
  });

  test("keeps the cursor when the thread was deleted", async () => {
    const { failure, flashes, store } = mount(() => harness());
    failure.error = new Error("message_not_found");
    expect(await store.setThreadRead(ch("C1"), stamp("1.1"), stamp("2.2"))).toBe(true);
    expect(store.threadReadTsFor(stamp("1.1"))).toBe(stamp("2.2"));
    expect(flashes).toEqual([]);
  });

  test("restores the previous cursor and flashes when the write fails", async () => {
    const { failure, flashes, store } = mount(() => harness());
    await store.setThreadRead(ch("C1"), stamp("1.1"), stamp("2.2"));
    failure.error = new Error("ratelimited");
    expect(await store.setThreadRead(ch("C1"), stamp("1.1"), stamp("3.3"))).toBe(false);
    expect(store.threadReadTsFor(stamp("1.1"))).toBe(stamp("2.2"));
    expect(flashes).toEqual(["Couldn't sync thread read state."]);
  });

  test("a failed first write leaves no cursor behind", async () => {
    const { failure, store } = mount(() => harness());
    failure.error = new Error("ratelimited");
    await store.setThreadRead(ch("C1"), stamp("1.1"), stamp("2.2"));
    expect(store.threadReadTsFor(stamp("1.1"))).toBeUndefined();
  });
});

describe("isThreadUnread", () => {
  const root = (extra: Partial<Message>) =>
    message("1.1", { isSubscribed: true, latestReply: stamp("5.5"), ...extra });

  test.each([
    ["a newer reply than the root", root({}), true],
    ["no replies", root({ latestReply: undefined }), false],
    ["not subscribed", root({ isSubscribed: false }), false],
    ["server read cursor at the latest reply", root({ threadLastRead: stamp("5.5") }), false],
    ["server read cursor before the latest reply", root({ threadLastRead: stamp("3.3") }), true],
  ])("%s", (_name, thread, expected) => {
    expect(mount(() => harness()).store.isThreadUnread(thread)).toBe(expected);
  });

  test("a local cursor beats the server cursor", () => {
    const { store } = mount(() => harness());
    const thread = root({ threadLastRead: stamp("1.1") });
    expect(store.isThreadUnread(thread)).toBe(true);
    store.setThreadReadTs(stamp("1.1"), stamp("5.5"));
    flushSolid();
    expect(store.isThreadUnread(thread)).toBe(false);
  });
});

describe("window activity", () => {
  test("viewed needs a focused window and a seen bottom", () => {
    browser.setFocused(false);
    const { store } = mount(() => harness());
    store.setBottomSeen(ch("C1"), true);
    flushSolid();
    expect(store.isViewed(ch("C1"))).toBe(false);
    browser.setFocused(true);
    flushSolid();
    expect(store.isViewed(ch("C1"))).toBe(true);
    browser.setFocused(false);
    flushSolid();
    expect(store.isViewed(ch("C1"))).toBe(false);
  });

  test("tracked bottom state follows the view and resets when the view changes or goes away", () => {
    browser.setFocused(true);
    const [view, setView] = createSignal<Channel["id"] | undefined>(ch("C1"));
    const [atBottom, setAtBottom] = createSignal(true);
    const { store } = mount(() => {
      const { store } = harness();
      store.trackBottomSeen(view, atBottom);
      return { store };
    });
    expect(store.isViewed(ch("C1"))).toBe(true);
    setAtBottom(false);
    flushSolid();
    expect(store.isViewed(ch("C1"))).toBe(false);
    setAtBottom(true);
    flushSolid();
    setView(ch("C2"));
    flushSolid();
    expect(store.isViewed(ch("C1"))).toBe(false);
    expect(store.isViewed(ch("C2"))).toBe(true);
    setView(undefined);
    flushSolid();
    expect(store.isViewed(ch("C2"))).toBe(false);
    setView(ch("C2"));
    flushSolid();
    unmountAll();
    flushSolid();
    expect(store.isViewed(ch("C2"))).toBe(false);
  });

  test("every listener is removed on dispose", () => {
    mount(() => harness());
    expect(browser.listenerCount()).toBe(3);
    unmountAll();
    expect(browser.listenerCount()).toBe(0);
  });
});
