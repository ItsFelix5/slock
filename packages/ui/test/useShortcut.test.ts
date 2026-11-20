import { describe, expect, test } from "bun:test";
import { createRoot, createSignal, flush } from "solid-js";
import {
  dispatchManualShortcut,
  inside,
  listShortcuts,
  type ShortcutDef,
  shortcutConflicts,
  useShortcut,
} from "../src/hooks/useShortcut";

const body = () => document.body;

function element(tag: "div" | "input" | "textarea" | "select", editable = false) {
  const created = document.createElement(tag);
  if (editable) created.setAttribute("contenteditable", "true");
  body().append(created);
  return created;
}

interface KeyInit {
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

    const optIn = register({ allowInInputs: true, log, name: "optIn" });
    press({ key: "x" }, element("input"));
    optIn();
    const scoped = register({ log, name: "scoped", target: () => true });
    press({ key: "x" }, element("input"));
    scoped();
    expect(log).toEqual(["optIn", "scoped"]);
  });

  test("allowRepeat false ignores held keys", () => {
    const log: string[] = [];
    const dispose = register({ allowRepeat: false, log, name: "once" });
    press({ key: "x", repeat: true });
    press({ key: "x" });
    expect(log).toEqual(["once"]);
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
    expect(dispatchManualShortcut(keydown({ key: "x" }))).toBe(true);
    expect(dispatchManualShortcut(keydown({ key: "q" }))).toBe(false);
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
    const entries = listShortcuts().filter((entry) => entry.id === "test.dup");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.isCustom).toBe(false);
    one();
    two();
  });

  test("general conflicts with everything, other scopes only with themselves", () => {
    const disposers = [
      register({ combo: { key: "q" }, name: "g", scope: "general" }),
      register({ combo: { key: "q" }, name: "c", scope: "composer" }),
      register({ combo: { key: "q" }, name: "l", scope: "lists" }),
      register({ combo: { key: "z" }, name: "m", scope: "messages" }),
    ];
    const conflictsOf = (id: string, key: string) =>
      shortcutConflicts(id, { key })
        .map((info) => info.id)
        .sort();
    expect(conflictsOf("test.c", "q")).toEqual(["test.g"]);
    expect(conflictsOf("test.g", "q")).toEqual(["test.c", "test.l"]);
    expect(conflictsOf("test.m", "q")).toEqual(["test.g"]);
    expect(conflictsOf("test.m", "z")).toEqual([]);
    for (const dispose of disposers) dispose();
  });
});
