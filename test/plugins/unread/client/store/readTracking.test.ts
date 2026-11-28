import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Message } from "@slock/types";
import { createSignal, createStore, flush as flushSolid } from "solid-js";
import type { ThreadRef } from "../../../../../packages/plugins/src/messages/client/api";
import { ch, stamp } from "../../../../support/slack";
import {
  C1,
  channel,
  fakeWindow,
  flush,
  harness,
  message,
  mount,
  unmountAll,
} from "./unreadTestKit";

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
    const [messagesByChannel, setMessagesStore] = createStore<Record<string, Message[]>>({
      C1: initialMessages,
    });
    const [threadMessages, setThreadMessagesStore] = createStore<Record<string, Message[]>>({});
    const [visibleThreads, setVisibleThreadsSignal] = createSignal<ThreadRef[]>([]);
    const [visible, setVisible] = createSignal(true);
    const setChannelVisible = (next: boolean) => {
      setVisible(next);
      flushSolid();
    };
    const setMessages = (id: string, update: (list: Message[]) => Message[]) => {
      setMessagesStore((state) => {
        state[id] = update(state[id] ?? []);
      });
      flushSolid();
    };
    const setThreadMessages = (id: string, replies: Message[]) => {
      setThreadMessagesStore((state) => {
        state[id] = replies;
      });
      flushSolid();
    };
    const setVisibleThreads = (threads: { channelId: string; ts: string }[]) => {
      setVisibleThreadsSignal(
        threads.map((t) => ({ channelId: ch(t.channelId), ts: stamp(t.ts) })),
      );
      flushSolid();
    };
    env.store.wireReadTracking({
      hasNewerHistory: () => false,
      messagesByChannel,
      threadMessages,
      visibleThreads,
      visibleViews: () => (visible() ? [{ id: C1, kind: "channel" }] : []),
    });
    return { ...env, setChannelVisible, setMessages, setThreadMessages, setVisibleThreads };
  });
}

describe("channels", () => {
  test("anchors the divider at the last read cursor when there are newer messages", () => {
    const { store } = wired([message("1.000"), message("3.000")], 2000);
    expect(store.unreadDividerTsForChannel(ch("C1"))).toBe(2000);
  });

  test("anchors the divider at infinity when everything is read", () => {
    const { store } = wired([message("1.000"), message("2.000")], 2000);
    expect(store.unreadDividerTsForChannel(ch("C1"))).toBe(Infinity);
  });

  test("marks the latest message read once the bottom is seen", async () => {
    const { channelReads, patches, store } = wired([message("1.000"), message("3.000")], 2000);
    expect(channelReads).toEqual([]);
    store.setBottomSeen(ch("C1"), true);
    await flush();
    expect(channelReads).toEqual([["C1", "3.000"]]);
    expect(store.isChannelUnread(ch("C1"))).toBe(false);
    expect(store.lastReadFor(ch("C1"))).toBe(3000);
    expect(patches).toContainEqual(["C1", { mentions: 0 }]);
  });

  test("does not mark read while the window is inactive", async () => {
    browser.setFocused(false);
    const { channelReads, store } = wired([message("1.000"), message("3.000")], 2000);
    store.setBottomSeen(ch("C1"), true);
    await flush();
    expect(channelReads).toEqual([]);
    expect(store.isChannelUnread(ch("C1"))).toBe(true);
  });

  test("never marks a pending message read", async () => {
    const { channelReads, store } = wired(
      [message("1.000"), message("3.000", { id: "pending-3" })],
      2000,
    );
    store.setBottomSeen(ch("C1"), true);
    await flush();
    expect(channelReads).toEqual([]);
  });

  test("marks again when a newer message arrives while viewed", async () => {
    const { channelReads, setMessages, store } = wired([message("3.000")], 2000);
    store.setBottomSeen(ch("C1"), true);
    await flush();
    setMessages("C1", (list) => [...list, message("4.000")]);
    await flush();
    expect(channelReads).toEqual([
      ["C1", "3.000"],
      ["C1", "4.000"],
    ]);
  });

  test("a view that is no longer visible loses its divider and anchors afresh when shown again", () => {
    const { setChannelVisible, store } = wired([message("1.000"), message("3.000")], 2000);
    expect(store.unreadDividerTsForChannel(ch("C1"))).toBe(2000);
    setChannelVisible(false);
    expect(store.unreadDividerTsForChannel(ch("C1"))).toBeUndefined();
    store.setLastReadByChannel(ch("C1"), 3000);
    flushSolid();
    setChannelVisible(true);
    expect(store.unreadDividerTsForChannel(ch("C1"))).toBe(Infinity);
  });

  test("a stale read cursor echo after our own mark does not mark again", async () => {
    const { channelReads, store } = wired([message("3.000")], 2000);
    store.setBottomSeen(ch("C1"), true);
    await flush();
    store.setLastReadByChannel(ch("C1"), 2000);
    flushSolid();
    await flush();
    expect(channelReads).toEqual([["C1", "3.000"]]);
    expect(store.lastReadFor(ch("C1"))).toBe(2000);
  });

  test("a failed write flashes once and the next message is still synced", async () => {
    const { channelReads, failure, flashes, setMessages, store } = wired([message("3.000")], 2000);
    failure.error = new Error("ratelimited");
    store.setBottomSeen(ch("C1"), true);
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
    env.store.setBottomSeen(stamp("1.000"), true);
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
    expect(store.threadReadTsFor(stamp("1.000"))).toBe(stamp("3.000"));
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
    env.store.setBottomSeen(stamp("1.000"), true);
    await flush();
    expect(env.threadReads).toHaveLength(1);
    expect(env.flashes).toEqual([]);
    expect(env.store.threadReadTsFor(stamp("1.000"))).toBe(stamp("2.000"));
  });
});
