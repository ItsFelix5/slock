import { createSignal } from "solid-js";
import type { ShortcutCombo } from "./shortcutCombo";

export type KeybindOverrides = Record<string, ShortcutCombo | null>;

const STORAGE_KEY = "slock-keybind-overrides";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export function createKeybindOverrides(storage: KeyValueStorage) {
  function load(): KeybindOverrides {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  const [overrides, setOverrides] = createSignal<KeybindOverrides>(load());

  function persist(next: KeybindOverrides) {
    setOverrides(next);
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return {
    clear(id: string): void {
      const next = { ...overrides() };
      delete next[id];
      persist(next);
    },
    overrides,
    resetAll(): void {
      persist({});
    },
    set(id: string, combo: ShortcutCombo | null): void {
      persist({ ...overrides(), [id]: combo });
    },
  };
}

const store = createKeybindOverrides(globalThis.localStorage);

export const keybindOverrides = store.overrides;
export const setKeybindOverride = store.set;
export const clearKeybindOverride = store.clear;
export const resetAllKeybinds = store.resetAll;
