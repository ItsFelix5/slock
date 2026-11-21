import { describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv, partialService } from "@slock/core/testing";
import type { Services } from "@slock/core/types";
import { ch, stamp } from "@slock/slack/testing";
import { provideUi } from "@slock/ui";
import { createRoot, flush } from "solid-js";
import querySetup from "../../../src/query/client/index";

const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
    flush();
  }
};

const reply = (body: object, status = 200) =>
  new Response(JSON.stringify({ ok: status < 400, ...body }), { status });

const failure = () => reply({ error: "boom" }, 500);

const item = (ts: string) => ({ message: { text: `msg ${ts}`, ts, user: "U1" }, ts });

let nextChannel = 0;

async function start(initialPins: string[]) {
  const channel = ch(`C${++nextChannel}`);
  const env = createFakeEnv(1, 1_000_000);
  let server = initialPins;
  env.fetch.respond(`/api/channels/${channel}/pins`, () => reply({ items: server.map(item) }));
  env.fetch.respond(new RegExp(`/api/messages/${channel}/.*/pin`), (call) => {
    const ts = call.url.split("/")[4] ?? "";
    server = call.method === "DELETE" ? server.filter((t) => t !== ts) : [...server, ts];
    return reply({});
  });
  const errors: string[] = [];
  const undos: string[] = [];
  const host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register(
    { id: "ui", setup: provideUi },
    { id: "query", setup: querySetup },
    {
      id: "feedback",
      setup: (ctx) =>
        ctx.provide(
          "feedback",
          partialService<Services["feedback"]>({
            error: (_key, message) => errors.push(message),
            flash: () => {},
            undo: {
              push: (entry) => void undos.push(entry.label),
              undo: () => Promise.resolve(undefined),
            },
          }),
        ),
    },
  );
  const { createPinnedSlice } = await import("../../../src/pins/client/store");
  const store = createRoot(() =>
    createPinnedSlice({
      panes: partialService<Services["shell.panes"]>({
        closePane: () => {},
        openInNewPane: () => "pane",
        panes: () => [],
      }),
    }),
  );
  return {
    channel,
    env,
    errors,
    setServer: (pins: string[]) => {
      server = pins;
    },
    store,
    undos,
  };
}

async function loaded(initialPins: string[]) {
  const kit = await start(initialPins);
  kit.store.ensurePinsLoaded(kit.channel);
  await settle();
  return kit;
}

describe("pin toggling", () => {
  test("unloaded pins read as not pinned until loaded", async () => {
    const { channel, store } = await start(["1.1"]);
    expect(store.isMessagePinned(channel, stamp("1.1"))).toBe(false);
    store.ensurePinsLoaded(channel);
    await settle();
    expect(store.isMessagePinned(channel, stamp("1.1"))).toBe(true);
    expect(store.isMessagePinned(channel, stamp("2.2"))).toBe(false);
  });

  test("pinning flips at once, blocks a second toggle while writing, then offers undo", async () => {
    const { channel, env, store, undos } = await loaded([]);
    const ts = stamp("5.5");
    env.fetch.hold(new RegExp(`/api/messages/${channel}/.*/pin`));
    const first = store.togglePinMessage(channel, ts);
    flush();
    expect(store.isMessagePinned(channel, ts)).toBe(true);
    expect(store.isPinPending(channel, ts)).toBe(true);
    expect(await store.togglePinMessage(channel, ts)).toBe(false);
    await settle();
    env.fetch.pending()[0]?.resolve(reply({}));
    expect(await first).toBe(true);
    expect(store.isPinPending(channel, ts)).toBe(false);
    expect(env.fetch.calls.filter((call) => call.method === "POST")).toHaveLength(1);
    expect(undos).toEqual(["pin message"]);
  });

  test("a failed pin is rolled back and reported", async () => {
    const { channel, env, errors, store, undos } = await loaded([]);
    const ts = stamp("5.5");
    env.fetch.respond(new RegExp(`/api/messages/${channel}/.*/pin`), failure);
    expect(await store.togglePinMessage(channel, ts)).toBe(false);
    expect(store.isMessagePinned(channel, ts)).toBe(false);
    expect(store.isPinPending(channel, ts)).toBe(false);
    expect(errors).toEqual(["Failed to update pin."]);
    expect(undos).toEqual([]);
  });

  test("unpinning drops the message from a loaded pinned list without a refetch", async () => {
    const { channel, env, store } = await loaded(["1.1", "2.2"]);
    await store.refreshPinnedMessages(channel);
    await settle();
    expect(store.pinnedMessagesFor(channel)?.map((pin) => pin.ts)).toEqual([
      stamp("1.1"),
      stamp("2.2"),
    ]);
    const listFetches = () => env.fetch.calls.filter((call) => call.url.endsWith("/pins")).length;
    const before = listFetches();
    await store.togglePinMessage(channel, stamp("1.1"));
    flush();
    expect(store.pinnedMessagesFor(channel)?.map((pin) => pin.ts)).toEqual([stamp("2.2")]);
    expect(listFetches()).toBe(before);
  });

  test("a failed unpin keeps the pin and refetches the pinned list", async () => {
    const { channel, env, store } = await loaded(["1.1", "2.2"]);
    await store.refreshPinnedMessages(channel);
    await settle();
    env.fetch.respond(new RegExp(`/api/messages/${channel}/.*/pin`), failure);
    expect(await store.togglePinMessage(channel, stamp("1.1"))).toBe(false);
    await settle();
    expect(store.isMessagePinned(channel, stamp("1.1"))).toBe(true);
    expect(store.pinnedMessagesFor(channel)?.map((pin) => pin.ts)).toEqual([
      stamp("1.1"),
      stamp("2.2"),
    ]);
  });
});

describe("pin events", () => {
  test("events for a channel that was never loaded change nothing", async () => {
    const { channel, store } = await start(["1.1"]);
    store.applyPinEvent(channel, stamp("1.1"), true);
    expect(store.isMessagePinned(channel, stamp("1.1"))).toBe(false);
  });

  test("an event updates a loaded channel and refetches the pinned list from the server", async () => {
    const { channel, setServer, store } = await loaded(["1.1"]);
    await store.refreshPinnedMessages(channel);
    await settle();
    setServer(["1.1", "3.3"]);
    store.applyPinEvent(channel, stamp("3.3"), true);
    expect(store.isMessagePinned(channel, stamp("3.3"))).toBe(true);
    await settle();
    expect(store.pinnedMessagesFor(channel)?.map((pin) => pin.ts)).toEqual([
      stamp("1.1"),
      stamp("3.3"),
    ]);
  });
});

describe("pinned list status", () => {
  test("is loading before the first load, then ready", async () => {
    const { channel, store } = await start([]);
    expect(store.isPinnedMessagesLoading(channel)).toBe(true);
    await store.refreshPinnedMessages(channel);
    await settle();
    expect(store.isPinnedMessagesLoading(channel)).toBe(false);
    expect(store.hasPinnedMessagesError(channel)).toBe(false);
  });
});
