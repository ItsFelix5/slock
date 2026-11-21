import { describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv, partialService } from "@slock/core/testing";
import type { Services } from "@slock/core/types";
import { ch } from "@slock/slack/testing";
import type { UserPrefs } from "@slock/types";
import { provideUi } from "@slock/ui";
import { createRoot, createSignal, flush } from "solid-js";
import querySetup from "../../../src/query/client/index";

const A = ch("C1");
const B = ch("C2");

const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
    flush();
  }
};

const ok = () => new Response(JSON.stringify({ ok: true }));
const failure = () => new Response(JSON.stringify({ error: "boom", ok: false }), { status: 500 });

function prefs(patch: Partial<UserPrefs> = {}): UserPrefs {
  return {
    channelFrecency: {},
    channelNotifications: {},
    channelSections: {},
    emojiUse: {},
    globalNotifications: {
      desktop: "all",
      desktopPushEnabled: true,
      keywords: [],
      mpdmDesktop: "all",
      noTextInNotifications: false,
      pushIdleWait: 5,
      pushShowPreview: true,
      threadsEverything: false,
    },
    highlightWords: [],
    mutedChannels: [],
    notifyAllChannels: [],
    sectionCollapsed: {},
    sectionSidebar: {},
    sectionSort: {},
    ...patch,
  };
}

async function start(initial?: UserPrefs) {
  const env = createFakeEnv(1, 1_000_000);
  env.fetch.respond(
    "/api/dnd/snooze",
    () => new Response(JSON.stringify({ endtime: null, ok: true })),
  );
  const errors: string[] = [];
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
            undo: { push: () => {}, undo: () => Promise.resolve(undefined) },
          }),
        ),
    },
  );
  const { createPrefsStore } = await import("../../../src/prefs/client/store");
  const [userPrefs, setUserPrefs] = createSignal<UserPrefs | undefined>(initial);
  const store = createRoot(() => createPrefsStore({ userPrefs }));
  await settle();
  return { env, errors, setUserPrefs, store };
}

const bodyOf = (init: RequestInit | undefined) => JSON.parse(String(init?.body));

describe("mute toggles", () => {
  test("rapid toggles on two channels end with both muted and one coalesced final write", async () => {
    const { env, store } = await start(prefs());
    env.fetch.hold(/muted-channels/);
    const first = store.toggleMuteChannel(A);
    flush();
    const second = store.toggleMuteChannel(B);
    await settle();
    expect(store.isChannelMuted(A)).toBe(true);
    expect(store.isChannelMuted(B)).toBe(true);
    for (const call of env.fetch.pending()) call.resolve(ok());
    await settle();
    for (const call of env.fetch.pending()) call.resolve(ok());
    await Promise.all([first, second]);
    const writes = env.fetch.calls.filter((call) => /muted-channels/.test(call.url));
    expect(bodyOf(writes.at(-1)?.init).channelIds).toEqual([A, B]);
    expect(store.isChannelMuted(A) && store.isChannelMuted(B)).toBe(true);
  });

  test("a failed write restores the last confirmed mute list and reports it", async () => {
    const { env, errors, store } = await start(prefs({ mutedChannels: [B] }));
    env.fetch.respond(/muted-channels/, failure);
    const synced = await store.toggleMuteChannel(A);
    await settle();
    expect(synced).toBe(false);
    expect(errors).toEqual(["Failed to update mute setting."]);
    expect(store.isChannelMuted(A)).toBe(false);
    expect(store.isChannelMuted(B)).toBe(true);
  });

  test("a confirmed write moves the baseline a later failure falls back to", async () => {
    const { env, store } = await start(prefs());
    env.fetch.respond(/muted-channels/, ok);
    await store.toggleMuteChannel(A);
    env.fetch.respond(/muted-channels/, failure);
    await store.toggleMuteChannel(B);
    await settle();
    expect(store.isChannelMuted(A)).toBe(true);
    expect(store.isChannelMuted(B)).toBe(false);
  });

  test("nothing is written before preferences have loaded", async () => {
    const { env, errors, store } = await start();
    expect(await store.toggleMuteChannel(A)).toBe(false);
    expect(errors).toHaveLength(1);
    expect(store.isChannelMuted(A)).toBe(false);
    expect(env.fetch.calls.some((call) => /muted-channels/.test(call.url))).toBe(false);
  });

  test("remote prefs seed once and later loads do not overwrite local toggles", async () => {
    const { env, setUserPrefs, store } = await start();
    setUserPrefs(prefs({ mutedChannels: [A] }));
    await settle();
    expect(store.isChannelMuted(A)).toBe(true);
    env.fetch.respond(/muted-channels/, ok);
    await store.toggleMuteChannel(A);
    setUserPrefs(prefs({ mutedChannels: [A] }));
    await settle();
    expect(store.isChannelMuted(A)).toBe(false);
  });
});

describe("highlight words", () => {
  const words = (store: Awaited<ReturnType<typeof start>>["store"]) => store.highlightWords();

  test("duplicates differing only by case and blanks are not written", async () => {
    const { env, store } = await start(prefs({ highlightWords: ["Foo"] }));
    expect(await store.addHighlightWord("foo")).toBe(false);
    expect(await store.addHighlightWord("   ")).toBe(false);
    expect(env.fetch.calls.some((call) => /highlight-words/.test(call.url))).toBe(false);
    expect(words(store)).toEqual(["Foo"]);
  });

  test("a second change while one is in flight is refused and the first one wins", async () => {
    const { env, store } = await start(prefs());
    env.fetch.hold(/highlight-words/);
    const first = store.addHighlightWord("a");
    flush();
    const second = await store.addHighlightWord("b");
    await settle();
    expect(second).toBe(false);
    expect(store.isHighlightWordsPending()).toBe(true);
    env.fetch.pending()[0]?.resolve(ok());
    expect(await first).toBe(true);
    expect(words(store)).toEqual(["a"]);
    expect(store.isHighlightWordsPending()).toBe(false);
  });

  test("a failed write puts the previous words back", async () => {
    const { env, errors, store } = await start(prefs({ highlightWords: ["keep"] }));
    env.fetch.respond(/highlight-words/, failure);
    expect(await store.addHighlightWord("new")).toBe(false);
    expect(words(store)).toEqual(["keep"]);
    expect(errors).toEqual(["Failed to update pingwords."]);
    env.fetch.respond(/highlight-words/, ok);
    expect(await store.removeHighlightWord("keep")).toBe(true);
    expect(words(store)).toEqual([]);
  });

  test("matching is case insensitive and returns the matched text", async () => {
    const { store } = await start(prefs({ highlightWords: ["deploy"] }));
    expect(store.matchingHighlightWord("we Deploy now")).toBe("Deploy");
    expect(store.matchingHighlightWord("nothing here")).toBeUndefined();
  });
});

describe("dnd writes", () => {
  test("a failed snooze restores the previous state and a second call while pending is refused", async () => {
    const { env, errors, store } = await start(prefs());
    env.fetch.hold(/dnd\/snooze/);
    const first = store.snoozeDnd(30);
    flush();
    expect(store.dndSnoozedUntil()).toBe(1_000_000 + 30 * 60_000);
    expect(await store.snoozeDnd(60)).toBe(false);
    await settle();
    env.fetch.pending()[0]?.resolve(failure());
    expect(await first).toBe(false);
    expect(store.dndSnoozedUntil()).toBeNull();
    expect(errors).toEqual(["Failed to enable Do Not Disturb."]);
  });

  test("a failed end restores the running snooze", async () => {
    const { env, errors, store } = await start(prefs());
    env.fetch.respond(/dnd\/snooze/, ok);
    await store.snoozeDnd(30);
    env.fetch.respond(/dnd\/snooze/, failure);
    expect(await store.endDnd()).toBe(false);
    expect(store.isDndActive()).toBe(true);
    expect(errors).toEqual(["Failed to disable Do Not Disturb."]);
  });
});
