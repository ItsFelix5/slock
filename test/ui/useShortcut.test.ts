import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { service } from "@slock/core/solid";
import { createRoot, createSignal, flush } from "solid-js";
import type { ShortcutDef } from "../../packages/ui/src/hooks/shortcutRegistry";
import { inside, useShortcut } from "../../packages/ui/src/hooks/useShortcut";
import { startFakeEnv } from "./fakeEnv";

const ui = service("ui");
let fake: Awaited<ReturnType<typeof startFakeEnv>>;

beforeEach(async () => {
  fake = await startFakeEnv();
});
afterEach(() => fake.stop());

const body = () => document.body;

function element(tag: "div" | "input" | "textarea" | "select", editable = false) {
  const created = document.createElement(tag);
  if (editable) created.setAttribute("contenteditable", "true");
  body().append(created);
  return created;
}

interface KeyInit {
  ctrlKey?: boolean;
  isComposing?: boolean;
  key: string;
  repeat?: boolean;
}

function keydown(init: KeyInit) {
  return new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
}

function press(init: KeyInit, target: Element = body()) {
  const event = keydown(init);
  target.dispatchEvent(event);
  return event;
}

let counter = 0;
function register(overrides: Partial<ShortcutDef> & { log?: string[]; name?: string }) {
  const { log, name = `s${counter++}`, ...rest } = overrides;
  const dispose = createRoot((disposeRoot) => {
    useShortcut({
      combo: { key: "x" },
      group: "App",
      handler: () => log?.push(name),
      id: `test.${name}`,
      label: name,
      scope: "general",
      ...rest,
    });
    return disposeRoot;
  });
  flush();
  return dispose;
}

describe("useShortcut dispatch", () => {
  test("runs the matching handler and prevents the default", () => {
    const log: string[] = [];
    const dispose = register({ log, name: "a" });
    const event = press({ key: "x" });
    expect(log).toEqual(["a"]);
    expect(event.defaultPrevented).toBe(true);
    press({ key: "y" });
    expect(log).toEqual(["a"]);
    dispose();
  });

  test("a disabled shortcut is skipped and reacts to its signal", () => {
    const log: string[] = [];
    const [enabled, setEnabled] = createSignal(false);
    const dispose = register({ enabled, log, name: "gated" });
    press({ key: "x" });
    setEnabled(true);
    flush();
    press({ key: "x" });
    expect(log).toEqual(["gated"]);
    dispose();
  });

  test("shortcuts that act on the page wait until dialogs close", () => {
    const log: string[] = [];
    const disposers = [
      register({ combo: { key: "m" }, log, name: "message", scope: "messages" }),
      register({ combo: { key: "j" }, group: "Channels and search", log, name: "channel" }),
      register({ combo: { key: "d" }, log, name: "dialog" }),
    ];
    const layer = ui.focusLayers.push({});
    for (const key of ["m", "j", "d"]) press({ key });
    expect(log).toEqual(["dialog"]);
    ui.focusLayers.pop(layer);
    for (const key of ["m", "j"]) press({ key });
    expect(log).toEqual(["dialog", "message", "channel"]);
    for (const dispose of disposers) dispose();
  });

  test("typing targets only receive shortcuts that opt in or are scoped", () => {
    const log: string[] = [];
    const typingTargets = [
      element("input"),
      element("textarea"),
      element("select"),
      element("div", true),
    ];
    const plain = register({ log, name: "plain" });
    for (const target of typingTargets) press({ key: "x" }, target);
    expect(log).toEqual([]);
    plain();

    const combo = { key: "Enter" };
    const optIn = register({ allowInInputs: true, combo, log, name: "optIn" });
    press(combo, element("input"));
    optIn();
    const scoped = register({ combo, log, name: "scoped", target: () => true });
    press(combo, element("input"));
    scoped();
    expect(log).toEqual(["optIn", "scoped"]);
  });

  test("a single character stays text in a field, even for an opted in shortcut", () => {
    const log: string[] = [];
    const dispose = register({ allowInInputs: true, log, target: () => true });
    const typed = press({ key: "x" }, element("input"));
    expect(log).toEqual([]);
    expect(typed.defaultPrevented).toBe(false);
    dispose();
  });

  test("allowRepeat false ignores held keys but keeps them from the browser", () => {
    const log: string[] = [];
    const combo = { key: "f", mod: true };
    const dispose = register({ allowRepeat: false, combo, log, name: "once" });
    const held = press({ ctrlKey: true, key: "f", repeat: true });
    press({ ctrlKey: true, key: "f" });
    expect(log).toEqual(["once"]);
    expect(held.defaultPrevented).toBe(true);
    dispose();
  });

  test.each([
    { expected: 1, key: "x" },
    { expected: 2, key: "ArrowDown" },
    { allowRepeat: true, expected: 2, key: "x" },
  ])("a held $key runs $expected time(s)", ({ allowRepeat, expected, key }) => {
    const log: string[] = [];
    const dispose = register({ allowRepeat, combo: { key }, log });
    press({ key });
    press({ key, repeat: true });
    expect(log).toHaveLength(expected);
    dispose();
  });

  test("a target scoped shortcut beats a global one registered after it", () => {
    const log: string[] = [];
    const inner = element("div");
    const scoped = register({
      log,
      name: "scoped",
      target: inside(() => inner),
    });
    const global = register({ log, name: "global" });
    press({ key: "x" }, inner);
    press({ key: "x" }, element("div"));
    expect(log).toEqual(["scoped", "global"]);
    scoped();
    global();
  });

  test("passthrough runs the handler without preventing the default", () => {
    const log: string[] = [];
    const dispose = register({ log, name: "peek", passthrough: true });
    const event = press({ key: "x" });
    expect(log).toEqual(["peek"]);
    expect(event.defaultPrevented).toBe(false);
    dispose();
  });

  test("manual shortcuts only fire through dispatchManualShortcut", () => {
    const log: string[] = [];
    const dispose = register({ log, manual: true, name: "manual" });
    press({ key: "x" });
    expect(log).toEqual([]);
    expect(ui.shortcuts.dispatchManual(keydown({ key: "x" }))).toBe(true);
    expect(ui.shortcuts.dispatchManual(keydown({ key: "q" }))).toBe(false);
    expect(log).toEqual(["manual"]);
    dispose();
  });

  test("ignores IME composition and events another handler already took", () => {
    const log: string[] = [];
    const dispose = register({ log, name: "ime" });
    press({ isComposing: true, key: "x" });
    const target = element("div");
    target.addEventListener("keydown", (event) => event.preventDefault());
    press({ key: "x" }, target);
    expect(log).toEqual([]);
    dispose();
  });

  test("detaches its document listener with the last shortcut", () => {
    const log: string[] = [];
    const first = register({ log, name: "one" });
    const second = register({ log, name: "two" });
    first();
    press({ key: "x" });
    expect(log).toHaveLength(1);
    second();
    press({ key: "x" });
    expect(log).toHaveLength(1);
  });
});

describe("shortcut registry", () => {
  test("lists each id once and marks it as not customised", () => {
    const one = register({ combo: { key: "k", mod: true }, name: "dup" });
    const two = register({ combo: { key: "j" }, name: "dup" });
    const entries = ui.shortcuts.list().filter((entry) => entry.id === "test.dup");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.isCustom).toBe(false);
    one();
    two();
  });

  test("a declared shortcut is listed and rebindable before anything mounts it", () => {
    const listed = () => ui.shortcuts.list().filter((entry) => entry.id === "test.closed");
    const withdraw = ui.shortcuts.declare([
      { combo: { key: "d" }, group: "App", id: "test.closed", label: "Closed", scope: "general" },
    ]);
    expect(listed().map((entry) => entry.keys)).toEqual(["d"]);
    ui.keybinds.set("test.closed", { key: "e" });
    const log: string[] = [];
    const unmount = register({ combo: { key: "d" }, log, name: "closed" });
    expect(listed()).toHaveLength(1);
    press({ key: "d" });
    press({ key: "e" });
    expect(log).toEqual(["closed"]);
    unmount();
    expect(listed()).toHaveLength(1);
    withdraw();
    expect(listed()).toEqual([]);
  });

  test("general conflicts with everything, other scopes only with themselves", () => {
    const disposers = [
      register({ combo: { key: "q" }, name: "g", scope: "general" }),
      register({ combo: { key: "q" }, name: "c", scope: "composer" }),
      register({ combo: { key: "q" }, name: "l", scope: "lists" }),
      register({ combo: { key: "z" }, name: "m", scope: "messages" }),
    ];
    const conflictsOf = (id: string, key: string) =>
      ui.shortcuts
        .conflicts(id, { key })
        .map((info) => info.id)
        .sort();
    expect(conflictsOf("test.c", "q")).toEqual(["test.g"]);
    expect(conflictsOf("test.g", "q")).toEqual(["test.c", "test.l"]);
    expect(conflictsOf("test.m", "q")).toEqual(["test.g"]);
    expect(conflictsOf("test.m", "z")).toEqual([]);
    for (const dispose of disposers) dispose();
  });
});

describe("host lifetime", () => {
  test("a restarted host starts with an empty registry and no stale listener", async () => {
    const log: string[] = [];
    register({ log, name: "old" });
    const own = () => ui.shortcuts.list().filter((entry) => entry.id.startsWith("test."));
    expect(own()).toHaveLength(1);
    await fake.restart();
    expect(own()).toEqual([]);
    press({ key: "x" });
    expect(log).toEqual([]);
  });
});
