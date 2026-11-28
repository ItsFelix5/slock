import { describe, expect, test } from "bun:test";
import type { UserPrefs } from "@slock/types";
import { flush } from "solid-js";
import { createFakeEnv } from "../../../support/core";
import { ch } from "../../../support/slack";
import { settle, startPrefs } from "./prefsHarness";

const A = ch("C1");
const B = ch("C2");

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

function start(initial?: UserPrefs) {
  const env = createFakeEnv(1, 1_000_000);
  env.fetch.respond(
    "/api/dnd/snooze",
    () => new Response(JSON.stringify({ endtime: null, ok: true })),
  );
  return startPrefs(env, initial);
}

const bodyOf = (init: RequestInit | undefined) => JSON.parse(String(init?.body));

describe("mute toggles", () => {
  test("rapid toggles on two channels end with both muted and one coalesced final write", async () => {
    const { env, store, undos } = await start(prefs());
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
    expect(undos).toEqual(["mute channel"]);
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

  test("newer preferences replace the ones shown first", async () => {
    const { load, store } = await start(prefs({ highlightWords: ["old"], mutedChannels: [A] }));
    await load(prefs({ highlightWords: ["new"], notifyAllChannels: [B] }));
    expect(store.isChannelMuted(A)).toBe(false);
    expect(store.isChannelNotifyAll(B)).toBe(true);
    expect(store.highlightWords()).toEqual(["new"]);
  });

  test("a load during a write keeps the pending toggle on top", async () => {
    const { env, load, store } = await start(prefs());
    env.fetch.hold(/muted-channels/);
    const writing = store.toggleMuteChannel(A);
    await load(prefs());
    expect(store.isChannelMuted(A)).toBe(true);
    env.fetch.pending()[0]?.resolve(ok());
    await writing;
    await settle();
    expect(store.isChannelMuted(A)).toBe(true);
  });
});

describe("notify all", () => {
  test("shows at once, refuses a second click, and reports a failure", async () => {
    const { env, errors, store } = await start(prefs());
    env.fetch.hold(/notifications/);
    const first = store.toggleNotifyAllChannel(A);
    flush();
    expect(store.isChannelNotifyAll(A)).toBe(true);
    expect(store.isNotifyAllPending(A)).toBe(true);
    expect(await store.toggleNotifyAllChannel(A)).toBe(false);
    for (const call of env.fetch.pending()) call.resolve(failure());
    expect(await first).toBe(false);
    await settle();
    expect(store.isChannelNotifyAll(A)).toBe(false);
    expect(errors).toEqual(["Failed to update notification preference."]);
  });

  test("a half failed change restores the newest saved values", async () => {
    const saved = (value: string) => ({
      channelNotifications: { [A]: { desktop: value, mobile: value } },
      notifyAllChannels: [A],
    });
    const { env, load, store } = await start(prefs(saved("nothing")));
    await load(prefs(saved("everything")));
    env.fetch.hold(/notifications/);
    const toggled = store.toggleNotifyAllChannel(A);
    await settle();
    for (const call of env.fetch.pending())
      call.resolve(String(call.init?.body).includes("mobile") ? failure() : ok());
    await settle();
    const [rollback] = env.fetch.pending();
    expect(JSON.parse(String(rollback?.init?.body))).toEqual({
      target: "desktop",
      value: "everything",
    });
    rollback?.resolve(ok());
    expect(await toggled).toBe(false);
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
