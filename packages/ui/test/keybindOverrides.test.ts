import { describe, expect, test } from "bun:test";
import { createKeybindOverrides } from "../src/keybindOverrides";

function memoryStorage(initial?: string) {
  const data = new Map<string, string>(
    initial === undefined ? [] : [["slock-keybind-overrides", initial]],
  );
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("createKeybindOverrides", () => {
  test("starts empty without stored data", () => {
    expect(createKeybindOverrides(memoryStorage()).overrides()).toEqual({});
  });

  test("restores what an earlier session saved", () => {
    const first = memoryStorage();
    createKeybindOverrides(first).set("general.undo", { key: "u", mod: true });
    const second = createKeybindOverrides(memoryStorage(first.data.get("slock-keybind-overrides")));
    expect(second.overrides()).toEqual({
      "general.undo": { key: "u", mod: true },
    });
  });

  test("corrupted or unreadable storage falls back to no overrides", () => {
    expect(createKeybindOverrides(memoryStorage("{nope")).overrides()).toEqual({});
    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {},
    };
    expect(createKeybindOverrides(throwing).overrides()).toEqual({});
  });

  test("null marks a shortcut as unbound and is kept apart from clear", () => {
    const keybinds = createKeybindOverrides(memoryStorage());
    keybinds.set("a", null);
    expect(Object.hasOwn(keybinds.overrides(), "a")).toBe(true);
    expect(keybinds.overrides().a).toBeNull();
    keybinds.clear("a");
    expect(Object.hasOwn(keybinds.overrides(), "a")).toBe(false);
  });

  test("every change is written through to storage", () => {
    const storage = memoryStorage();
    const keybinds = createKeybindOverrides(storage);
    keybinds.set("a", { key: "x" });
    keybinds.set("b", { key: "y", shift: true });
    keybinds.clear("a");
    expect(JSON.parse(storage.data.get("slock-keybind-overrides") ?? "")).toEqual({
      b: { key: "y", shift: true },
    });
    keybinds.resetAll();
    expect(storage.data.get("slock-keybind-overrides")).toBe("{}");
  });

  test("does not mutate the previous snapshot", () => {
    const keybinds = createKeybindOverrides(memoryStorage());
    const before = keybinds.overrides();
    keybinds.set("a", { key: "x" });
    expect(before).toEqual({});
  });
});
