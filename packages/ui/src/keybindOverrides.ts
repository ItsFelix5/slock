import { createPref, type Env, isRecord } from "@slock/core";
import { createImmediateSignal } from "./immediateSignal";
import type { ShortcutCombo } from "./shortcutCombo";

export type KeybindOverrides = Record<string, ShortcutCombo | null>;

const STORAGE_KEY = "slock-keybind-overrides";

function parseKey(value: unknown): string | readonly string[] | undefined {
  if (typeof value === "string") return value;
  return Array.isArray(value) && value.every((key) => typeof key === "string") ? value : undefined;
}

function parseFlag(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function parseCombo(value: unknown): ShortcutCombo | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return;
  const key = parseKey(value.key);
  if (key === undefined) return;
  const combo: ShortcutCombo = { key };
  const mod = parseFlag(value.mod);
  const shift = parseFlag(value.shift);
  const alt = parseFlag(value.alt);
  if (mod !== undefined) combo.mod = mod;
  if (shift !== undefined) combo.shift = shift;
  if (alt !== undefined) combo.alt = alt;
  return combo;
}

function parseOverrides(value: unknown): KeybindOverrides | undefined {
  if (!isRecord(value)) return;
  const overrides: KeybindOverrides = {};
  for (const [id, entry] of Object.entries(value)) {
    const combo = parseCombo(entry);
    if (combo !== undefined) overrides[id] = combo;
  }
  return overrides;
}

export function createKeybindOverrides(storage: Env["storage"]) {
  const pref = createPref<KeybindOverrides>(storage, {
    fallback: {},
    key: STORAGE_KEY,
    parse: parseOverrides,
  });
  const [overrides, setOverrides] = createImmediateSignal(pref.get());
  const stopSync = pref.onRemoteChange(setOverrides);

  function persist(next: KeybindOverrides) {
    setOverrides(next);
    pref.set(next);
  }

  return {
    clear(id: string): void {
      const next = { ...overrides() };
      delete next[id];
      persist(next);
    },
    dispose: stopSync,
    overrides,
    resetAll(): void {
      persist({});
    },
    set(id: string, combo: ShortcutCombo | null): void {
      persist({ ...overrides(), [id]: combo });
    },
  };
}
