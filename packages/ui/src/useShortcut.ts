import { type Accessor, createSignal, onCleanup, onMount } from "solid-js";
import { keybindOverrides } from "./keybindOverrides";

export type ShortcutScope = "general" | "composer" | "messages";

export interface ShortcutCombo {
  key: string | readonly string[];
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface ShortcutDef {
  id: string;
  combo: ShortcutCombo;
  handler: (e: KeyboardEvent) => void;
  enabled?: Accessor<boolean>;

  allowInInputs?: boolean;

  allowRepeat?: boolean;
  label: string;
  scope: ShortcutScope;
}

export interface ShortcutInfo {
  id: string;
  label: string;
  scope: ShortcutScope;
  defaultCombo: ShortcutCombo;
  combo: ShortcutCombo | null;
  keys: string;
  isCustom: boolean;
}

interface RegisteredShortcut extends ShortcutDef {
  enabled: Accessor<boolean>;
}

const shortcuts: RegisteredShortcut[] = [];
const [registryVersion, bumpRegistryVersion] = createSignal(0, {
  equals: false,
});

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

const NAMED_KEYS: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Escape: "Esc",
  " ": "Space",
};

const CODE_FALLBACK: Record<string, string> = {
  "/": "Slash",
};

const CAPTURE_IGNORED_KEYS = new Set(["Alt", "AltGraph", "Control", "Meta", "OS", "Shift"]);

function comboKeys(combo: ShortcutCombo): readonly string[] {
  return typeof combo.key === "string" ? [combo.key] : combo.key;
}

function normalizeKeys(key: string | readonly string[]): string[] {
  return comboKeys({ key }).map((k) => k.toLowerCase());
}

function matchesCombo(e: KeyboardEvent, combo: ShortcutCombo): boolean {
  if (Boolean(combo.mod) !== (e.ctrlKey || e.metaKey)) return false;
  if (Boolean(combo.shift) !== e.shiftKey) return false;
  if (Boolean(combo.alt) !== e.altKey) return false;
  return comboKeys(combo).some((key) => {
    if (e.key.toLowerCase() === key.toLowerCase()) return true;
    const fallbackCode = CODE_FALLBACK[key];
    return fallbackCode !== undefined && e.code === fallbackCode;
  });
}

function keyLabel(key: string, uppercase: boolean): string {
  const named = NAMED_KEYS[key];
  if (named) return named;
  return key.length === 1 ? (uppercase ? key.toUpperCase() : key.toLowerCase()) : key;
}

export function comboLabel(combo: ShortcutCombo): string {
  const hasModifier = Boolean(combo.mod || combo.shift || combo.alt);
  const parts: string[] = [];
  if (combo.mod) parts.push("Ctrl/⌘");
  if (combo.shift) parts.push("Shift");
  if (combo.alt) parts.push("Alt");
  parts.push(
    comboKeys(combo)
      .map((key) => keyLabel(key, hasModifier))
      .join(" / "),
  );
  return parts.join(" ");
}

export function comboFromEvent(e: KeyboardEvent): ShortcutCombo | null {
  if (CAPTURE_IGNORED_KEYS.has(e.key)) return null;
  return {
    key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
    mod: e.ctrlKey || e.metaKey,
    shift: e.shiftKey,
    alt: e.altKey,
  };
}

export function combosOverlap(a: ShortcutCombo, b: ShortcutCombo): boolean {
  if (Boolean(a.mod) !== Boolean(b.mod)) return false;
  if (Boolean(a.shift) !== Boolean(b.shift)) return false;
  if (Boolean(a.alt) !== Boolean(b.alt)) return false;
  const bKeys = normalizeKeys(b.key);
  return normalizeKeys(a.key).some((key) => bKeys.includes(key));
}

function effectiveCombo(shortcut: RegisteredShortcut): ShortcutCombo | null {
  const overrides = keybindOverrides();
  return Object.hasOwn(overrides, shortcut.id) ? overrides[shortcut.id] : shortcut.combo;
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  const typing = isTypingTarget(event.target);
  let winner: RegisteredShortcut | undefined;
  let winnerCombo: ShortcutCombo | undefined;
  let collisions: RegisteredShortcut[] | undefined;
  for (let index = shortcuts.length - 1; index >= 0; index -= 1) {
    const shortcut = shortcuts[index];
    if (!shortcut.enabled()) continue;
    if (typing && !shortcut.allowInInputs) continue;
    if (event.repeat && shortcut.allowRepeat === false) continue;
    const combo = effectiveCombo(shortcut);
    if (!(combo && matchesCombo(event, combo))) continue;
    if (winner) {
      collisions ??= [];
      collisions.push(shortcut);
    } else {
      winner = shortcut;
      winnerCombo = combo;
    }
  }
  if (!(winner && winnerCombo)) return;
  event.preventDefault();
  winner.handler(event);
}

export function useShortcut(def: ShortcutDef) {
  onMount(() => {
    const shortcut: RegisteredShortcut = { ...def, enabled: def.enabled ?? (() => true) };
    if (shortcuts.length === 0) document.addEventListener("keydown", handleKeyDown);
    shortcuts.push(shortcut);
    bumpRegistryVersion((v) => v + 1);
    onCleanup(() => {
      const index = shortcuts.indexOf(shortcut);
      if (index >= 0) shortcuts.splice(index, 1);
      if (shortcuts.length === 0) document.removeEventListener("keydown", handleKeyDown);
      bumpRegistryVersion((v) => v + 1);
    });
  });
}

export function listShortcuts(): ShortcutInfo[] {
  registryVersion();
  const overrides = keybindOverrides();
  return shortcuts.map((shortcut) => {
    const isCustom = Object.hasOwn(overrides, shortcut.id);
    const combo = isCustom ? overrides[shortcut.id] : shortcut.combo;
    return {
      id: shortcut.id,
      label: shortcut.label,
      scope: shortcut.scope,
      defaultCombo: shortcut.combo,
      combo,
      keys: combo ? comboLabel(combo) : "Not set",
      isCustom,
    };
  });
}

export function shortcutConflicts(id: string, combo: ShortcutCombo): ShortcutInfo[] {
  return listShortcuts().filter(
    (s) => s.id !== id && s.combo !== null && combosOverlap(s.combo, combo),
  );
}

export function shortcutsByScope(): Map<
  ShortcutScope,
  { id: string; keys: string; label: string }[]
> {
  const byScope = new Map<ShortcutScope, { id: string; keys: string; label: string }[]>();
  for (const shortcut of listShortcuts()) {
    if (!shortcut.combo) continue;
    const entry = { id: shortcut.id, keys: shortcut.keys, label: shortcut.label };
    const list = byScope.get(shortcut.scope);
    if (list) list.push(entry);
    else byScope.set(shortcut.scope, [entry]);
  }
  return byScope;
}
