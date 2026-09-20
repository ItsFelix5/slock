import { createSignal } from "solid-js";
import type { ShortcutCombo } from "./useShortcut";

export type KeybindOverrides = Record<string, ShortcutCombo | null>;

const STORAGE_KEY = "slock-keybind-overrides";

function load(): KeybindOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const [keybindOverrides, setOverrides] = createSignal<KeybindOverrides>(load());

function persist(next: KeybindOverrides) {
  setOverrides(next);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function setKeybindOverride(id: string, combo: ShortcutCombo | null): void {
  persist({ ...keybindOverrides(), [id]: combo });
}

export function clearKeybindOverride(id: string): void {
  const next = { ...keybindOverrides() };
  delete next[id];
  persist(next);
}

export function resetAllKeybinds(): void {
  persist({});
}

export { keybindOverrides };
