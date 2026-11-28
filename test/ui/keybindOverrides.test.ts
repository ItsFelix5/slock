import { describe, expect, test } from "bun:test";
import { createKeybindOverrides } from "../../packages/ui/src/keybindOverrides";
import { createFakeEnv } from "../support/core";

const KEY = "slock-keybind-overrides";

function storageWith(initial?: string) {
  const { storage, writeRemote } = createFakeEnv();
  if (initial !== undefined) storage.set(KEY, initial);
  return { storage, writeRemote };
}

describe("createKeybindOverrides", () => {
  test("starts empty without stored data", () => {
    expect(createKeybindOverrides(storageWith().storage).overrides()).toEqual({});
  });

  test("restores what an earlier session saved", () => {
    const first = storageWith();
    createKeybindOverrides(first.storage).set("general.undo", { key: "u", mod: true });
    const second = createKeybindOverrides(storageWith(first.storage.get(KEY) ?? undefined).storage);
    expect(second.overrides()).toEqual({ "general.undo": { key: "u", mod: true } });
  });

  test("corrupted or unreadable storage falls back to no overrides", () => {
    expect(createKeybindOverrides(storageWith("{nope").storage).overrides()).toEqual({});
    const throwing = {
      ...createFakeEnv().storage,
      get: () => {
        throw new Error("denied");
      },
    };
    expect(createKeybindOverrides(throwing).overrides()).toEqual({});
  });

  test("drops entries that are not shortcut combos", () => {
    const stored = JSON.stringify({
      bad: 5,
      good: { key: ["a", "b"], alt: true },
      odd: { key: 1 },
      off: null,
    });
    expect(createKeybindOverrides(storageWith(stored).storage).overrides()).toEqual({
      good: { alt: true, key: ["a", "b"] },
      off: null,
    });
  });

  test("null marks a shortcut as unbound and is kept apart from clear", () => {
    const keybinds = createKeybindOverrides(storageWith().storage);
    keybinds.set("a", null);
    expect(Object.hasOwn(keybinds.overrides(), "a")).toBe(true);
    expect(keybinds.overrides().a).toBeNull();
    keybinds.clear("a");
    expect(Object.hasOwn(keybinds.overrides(), "a")).toBe(false);
  });

  test("every change is written through to storage", () => {
    const { storage } = storageWith();
    const keybinds = createKeybindOverrides(storage);
    keybinds.set("a", { key: "x" });
    keybinds.set("b", { key: "y", shift: true });
    keybinds.clear("a");
    expect(JSON.parse(storage.get(KEY) ?? "")).toEqual({ b: { key: "y", shift: true } });
    keybinds.resetAll();
    expect(storage.get(KEY)).toBe("{}");
  });

  test("follows changes made in another tab until disposed", () => {
    const { storage, writeRemote } = storageWith();
    const keybinds = createKeybindOverrides(storage);
    writeRemote(KEY, JSON.stringify({ a: { key: "z" } }));
    expect(keybinds.overrides()).toEqual({ a: { key: "z" } });
    keybinds.dispose();
    writeRemote(KEY, "{}");
    expect(keybinds.overrides()).toEqual({ a: { key: "z" } });
  });

  test("does not mutate the previous snapshot", () => {
    const keybinds = createKeybindOverrides(storageWith().storage);
    const before = keybinds.overrides();
    keybinds.set("a", { key: "x" });
    expect(before).toEqual({});
  });
});
