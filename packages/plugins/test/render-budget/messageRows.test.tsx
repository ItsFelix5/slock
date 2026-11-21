import { afterEach, describe, expect, test } from "bun:test";
import { createHost, type PluginDef } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv, partialService } from "@slock/core/testing";
import type { Services } from "@slock/core/types";
import { ch, uid } from "@slock/slack/testing";
import type { Message, User } from "@slock/types";
import { provideUi } from "@slock/ui";
import { render } from "@solidjs/web";
import { createSignal, createStore, flush, reconcile } from "solid-js";
import MessageRows from "../../src/messages/client/api/pane/MessageRows";
import { sourceOf } from "../composer/client/composerServices";
import { message, slackTs } from "../messages/client/messageFixture";

const CHANNEL = ch("C1");
const AUTHORS: User[] = [uid("U1"), uid("U2"), uid("U3")].map((id, i) => ({
  avatarColor: "#000",
  id,
  name: `user${i}`,
}));

const calls = { divider: 0, locations: 0, user: 0 };
let teardown: (() => void) | undefined;

function provide<K extends keyof Services>(id: K, service: Services[K]): PluginDef {
  return { id, setup: (ctx) => ctx.provide(id, service) };
}

function stubs(): PluginDef[] {
  return [
    { id: "ui", setup: provideUi },
    provide(
      "messages",
      partialService<Services["messages"]>({
        findAllMessageLocations: () => {
          calls.locations++;
          return [];
        },
      }),
    ),
    provide(
      "unread",
      partialService<Services["unread"]>({
        unreadDividerTsForChannel: () => {
          calls.divider++;
        },
      }),
    ),
    provide(
      "users",
      partialService<Services["users"]>({
        openUserProfile: () => {},
        userById: (id) => {
          calls.user++;
          return AUTHORS.find((user) => user.id === id);
        },
      }),
    ),
    provide("prefs", partialService<Services["prefs"]>({ highlightWords: sourceOf<string[]>([]) })),
  ];
}

function thread(count: number): Message[] {
  return Array.from({ length: count }, (_, i) =>
    message(slackTs(1_700_000_000 + i * 60), { userId: AUTHORS[i % AUTHORS.length]?.id }),
  );
}

async function mount(initial: Message[]) {
  const env = createFakeEnv();
  const host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register(...stubs());
  const [messages, setMessages] = createSignal(initial);
  const root = document.createElement("div");
  document.body.append(root);
  const dispose = render(() => <MessageRows channelId={CHANNEL} messages={messages()} />, root);
  teardown = () => {
    dispose();
    root.remove();
    host.stop();
  };
  flush();
  return { root, setMessages };
}

const reset = () => {
  calls.divider = 0;
  calls.locations = 0;
  calls.user = 0;
};

afterEach(() => teardown?.());

describe("message rows render budget", () => {
  test("appending one message to a long list does not rerun every row", async () => {
    const list = thread(60);
    const { root, setMessages } = await mount(list);
    const rows = () => root.querySelectorAll(".message-row-group").length;
    expect(rows()).toBe(60);
    reset();
    const added = message(slackTs(1_700_100_000), { userId: AUTHORS[0]?.id });
    setMessages([...list, added]);
    flush();
    expect(rows()).toBe(61);
    expect(calls.divider).toBeLessThanOrEqual(3);
    expect(calls.user).toBeLessThanOrEqual(3);
    expect(calls.locations).toBe(0);
  });

  test("prepending a page reuses the rows that were already there", async () => {
    const list = thread(60);
    const { root, setMessages } = await mount(list.slice(20));
    const before = [...root.querySelectorAll(".message-row-group")];
    reset();
    setMessages(list);
    flush();
    const after = [...root.querySelectorAll(".message-row-group")];
    expect(after).toHaveLength(60);
    expect(before.every((row) => after.includes(row))).toBe(true);
    expect(calls.user).toBeLessThanOrEqual(20 + 3);
  });
});

async function mountStore(initial: Message[]) {
  const env = createFakeEnv();
  const host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register(...stubs());
  const [state, setState] = createStore({ messages: initial });
  const root = document.createElement("div");
  document.body.append(root);
  const dispose = render(() => <MessageRows channelId={CHANNEL} messages={state.messages} />, root);
  teardown = () => {
    dispose();
    root.remove();
    host.stop();
  };
  flush();
  return {
    root,
    update: (next: Message[]) => {
      setState((s) => {
        reconcile(next, "id")(s.messages);
      });
      flush();
    },
  };
}

describe("message rows render budget on the reconciled store", () => {
  test("editing one message reruns only that row", async () => {
    const list = thread(60);
    const { root, update } = await mountStore(list);
    const rows = [...root.querySelectorAll(".message-row-group")];
    reset();
    update(list.map((m, i) => (i === 30 ? { ...m, text: "edited" } : m)));
    expect(calls).toEqual({ divider: 1, locations: 0, user: 0 });
    expect([...root.querySelectorAll(".message-row-group")]).toEqual(rows);
  });

  test("appending one message reruns only the new row", async () => {
    const list = thread(60);
    const { root, update } = await mountStore(list);
    reset();
    update([...list, message(slackTs(1_700_100_000), { userId: AUTHORS[0]?.id })]);
    expect(root.querySelectorAll(".message-row-group")).toHaveLength(61);
    expect(calls.divider).toBeLessThanOrEqual(1);
    expect(calls.user).toBeLessThanOrEqual(1);
  });

  test("deleting one message reruns only the deleted row and its follower", async () => {
    const list = thread(60);
    const { update } = await mountStore(list);
    reset();
    update(list.map((m, i) => (i === 30 ? { ...m, deleted: true } : m)));
    expect(calls.divider).toBeLessThanOrEqual(2);
    expect(calls.user).toBe(0);
  });
});
