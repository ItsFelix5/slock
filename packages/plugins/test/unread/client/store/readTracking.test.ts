import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Message } from "@slock/types";
import { createSignal } from "solid-js";
import { createStore } from "solid-js";
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

function wired(initialMessages: Message[], lastRead = 0) {
  return mount(() => {
    const env = harness({
      channels: [channel("C1", true)],
      directMessages: [],
      lastReadByChannel: { C1: lastRead },
    });
    const [messagesByChannel, setMessages] = createStore<Record<string, Message[]>>({
      C1: initialMessages,
    });
    const [threadMessages, setThreadMessages] = createStore<Record<string, Message[]>>({});
    const [visibleThreads, setVisibleThreads] = createSignal<{ channelId: string; ts: string }[]>(
      [],
    );
    env.store.wireReadTracking({
      hasNewerHistory: () => false,
      messagesByChannel,
      threadMessages,
      visibleThreads,
      visibleViews: () => [{ id: "C1", kind: "channel" }],
    });
    return { ...env, setMessages, setThreadMessages, setVisibleThreads };
  });
}

describe("channels", () => {
  test("anchors the divider at the last read cursor when there are newer messages", () => {
    const { store } = wired([message("1.000"), message("3.000")], 2000);
    expect(store.unreadDividerTsForChannel("C1")).toBe(2000);
  });

  test("anchors the divider at infinity when everything is read", () => {
    const { store } = wired([message("1.000"), message("2.000")], 2000);
    expect(store.unreadDividerTsForChannel("C1")).toBe(Infinity);
  });

  test("marks the latest message read once the bottom is seen", async () => {
    const { channelReads, patches, store } = wired([message("1.000"), message("3.000")], 2000);
    expect(channelReads).toEqual([]);
    store.setBottomSeen("C1", true);
    await flush();
    expect(channelReads).toEqual([["C1", "3.000"]]);
    expect(store.isChannelUnread("C1")).toBe(false);
    expect(store.lastReadFor("C1")).toBe(3000);
    expect(patches).toContainEqual(["C1", { mentions: 0 }]);
  });

  test("does not mark read while the window is inactive", async () => {
    browser.setFocused(false);
    const { channelReads, store } = wired([message("1.000"), message("3.000")], 2000);
    store.setBottomSeen("C1", true);
    await flush();
    expect(channelReads).toEqual([]);
    expect(store.isChannelUnread("C1")).toBe(true);
  });

  test("never marks a pending message read", async () => {
    const { channelReads, store } = wired(
      [message("1.000"), message("3.000", { id: "pending-3" })],
      2000,
    );
    store.setBottomSeen("C1", true);
    await flush();
    expect(channelReads).toEqual([]);
  });

  test("marks again when a newer message arrives while viewed", async () => {
    const { channelReads, setMessages, store } = wired([message("3.000")], 2000);
    store.setBottomSeen("C1", true);
    await flush();
    setMessages("C1", (list) => [...list, message("4.000")]);
    await flush();
    expect(channelReads).toEqual([
      ["C1", "3.000"],
      ["C1", "4.000"],
    ]);
  });

  test("a failed write flashes once and the next message is still synced", async () => {
    const { channelReads, failure, flashes, setMessages, store } = wired([message("3.000")], 2000);
    failure.error = new Error("ratelimited");
    store.setBottomSeen("C1", true);
    await flush();
    expect(flashes).toEqual(["Couldn't sync read state."]);
    failure.error = undefined;
    setMessages("C1", (list) => [...list, message("4.000")]);
    await flush();
    expect(channelReads).toEqual([
      ["C1", "3.000"],
      ["C1", "4.000"],
    ]);
    expect(flashes).toHaveLength(1);
  });
});

describe("threads", () => {
  const openThread = (replies: Message[]) => {
    const env = wired([message("1.000")]);
    env.setThreadMessages("1.000", replies);
    env.setVisibleThreads([{ channelId: "C1", ts: "1.000" }]);
    env.store.setBottomSeen("1.000", true);
    return env;
  };

  test("marks a subscribed thread read up to its latest live reply", async () => {
    const { store, threadReads } = openThread([
      message("1.000", { isSubscribed: true }),
      message("2.000"),
      message("3.000"),
      message("4.000", { deleted: true }),
    ]);
    await flush();
    expect(threadReads).toEqual([["C1", "1.000", "3.000"]]);
    expect(store.threadReadTsFor("1.000")).toBe("3.000");
  });

  test("leaves unsubscribed threads alone", async () => {
    const { threadReads } = openThread([message("1.000"), message("2.000")]);
    await flush();
    expect(threadReads).toEqual([]);
  });

  test("does not mark a thread with no replies", async () => {
    const { threadReads } = openThread([message("1.000", { isSubscribed: true })]);
    await flush();
    expect(threadReads).toEqual([]);
  });

  test("a deleted thread root is treated as read without a flash", async () => {
    const env = wired([message("1.000")]);
    env.failure.error = new Error("message_not_found");
    env.setThreadMessages("1.000", [message("1.000", { isSubscribed: true }), message("2.000")]);
    env.setVisibleThreads([{ channelId: "C1", ts: "1.000" }]);
    env.store.setBottomSeen("1.000", true);
    await flush();
    expect(env.threadReads).toHaveLength(1);
    expect(env.flashes).toEqual([]);
    expect(env.store.threadReadTsFor("1.000")).toBe("2.000");
  });
});
