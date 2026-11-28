import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import type { Message, Ts } from "@slock/types";
import { createRoot, createSignal, flush } from "solid-js";
import {
  createMessageFocus,
  createMessageFocusRegistry,
} from "../../../../../packages/plugins/src/messages/client/api/messageFocus";
import { createFeedScroll } from "../../../../../packages/plugins/src/messages/client/api/pane/scroll/feedScroll";
import { createFakeEnv } from "../../../../support/core";
import { stamp } from "../../../../support/slack";
import { C1, fakeWindow, message } from "../../../unread/client/store/unreadTestKit";

const disposers: (() => void)[] = [];
let browser: ReturnType<typeof fakeWindow>;
beforeEach(() => {
  browser = fakeWindow();
});
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  browser.restore();
});

const mountRoot = <T>(build: () => T) =>
  createRoot((dispose) => {
    disposers.push(dispose);
    return build();
  });

async function mountFocus(initial: Message[]) {
  const host = createHost({ env: createFakeEnv(), reactive: solidReactive });
  setHost(host);
  const [messages, setMessages] = createSignal(initial);
  const [landedTs, setLandedTs] = createSignal<Ts>();
  await host.register({
    id: "focus",
    setup: (ctx) => {
      ctx.provide("messages.focus", createMessageFocusRegistry());
    },
  });
  const focus = mountRoot(() =>
    createMessageFocus(messages, createFeedScroll({ isLive: () => false }), () => C1, { landedTs }),
  );
  flush();
  return { focus, setLandedTs, setMessages };
}

const list = (...tss: string[]) => tss.map((ts) => message(ts));

describe("initial focus", () => {
  test("starts on the newest message without an unread divider", async () => {
    const { focus } = await mountFocus(list("1.000", "2.000", "3.000"));
    expect(focus.focusedTs()).toBe(stamp("3.000"));
  });

  test("follows the row the landing picks, even after the first guess", async () => {
    const { focus, setLandedTs } = await mountFocus(list("1.000", "2.000", "3.000"));
    setLandedTs(stamp("2.000"));
    flush();
    expect(focus.focusedTs()).toBe(stamp("2.000"));
  });

  test("an empty list has no focus and the next list picks again", async () => {
    const { focus, setMessages } = await mountFocus([]);
    expect(focus.focusedTs()).toBeNull();
    setMessages(list("1.000", "2.000"));
    flush();
    expect(focus.focusedTs()).toBe(stamp("2.000"));
  });
});

describe("focus stability", () => {
  test("a focused row survives new messages arriving", async () => {
    const { focus, setMessages } = await mountFocus(list("1.000", "2.000"));
    focus.focusMessage(stamp("1.000"));
    flush();
    setMessages(list("1.000", "2.000", "3.000"));
    flush();
    expect(focus.focusedTs()).toBe(stamp("1.000"));
  });

  test("losing the focused message moves focus to a message that still exists", async () => {
    const { focus, setMessages } = await mountFocus(list("1.000", "2.000", "3.000"));
    focus.focusMessage(stamp("1.000"));
    flush();
    setMessages(list("2.000", "3.000"));
    flush();
    expect(focus.focusedTs()).toBe(stamp("3.000"));
  });

  test("clearing the list clears focus", async () => {
    const { focus, setMessages } = await mountFocus(list("1.000"));
    setMessages([]);
    flush();
    expect(focus.focusedTs()).toBeNull();
  });
});
