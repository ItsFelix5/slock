import { defined } from "@slock/core";
import { type Accessor, createSignal } from "solid-js";
import type { KeybindOverrides } from "../keybindOverrides";
import { comboLabel, combosOverlap, matchesCombo, type ShortcutCombo } from "../shortcutCombo";

export const SHORTCUT_GROUPS = [
  "Channels and search",
  "Panes",
  "Canvas",
  "Media",
  "App",
  "Lists",
  "Formatting",
  "Message box",
  "Message actions",
] as const;

export type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

export type ShortcutScope = "general" | "composer" | "lists" | "messages";

export interface ShortcutDef {
  id: string;
  combo: ShortcutCombo;
  handler: (e: KeyboardEvent) => void;
  enabled?: Accessor<boolean>;

  allowInInputs?: boolean;

  allowRepeat?: boolean;
  passthrough?: boolean;
  target?: (element: Element) => boolean;
  label: string;
  manual?: boolean;
  splitModifier?: boolean;
  scope: ShortcutScope;
  group: ShortcutGroup;
}

export type ShortcutOptions = Pick<ShortcutDef, "allowInInputs" | "enabled" | "manual" | "target">;

export interface ShortcutInfo {
  id: string;
  label: string;
  scope: ShortcutScope;
  group: ShortcutGroup;
  defaultCombo: ShortcutCombo;
  combo: ShortcutCombo | null;
  keys: string;
  isCustom: boolean;
}

interface RegisteredShortcut extends ShortcutDef {
  enabled: Accessor<boolean>;
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function scopesOverlap(a: ShortcutScope, b: ShortcutScope): boolean {
  return a === b || a === "general" || b === "general";
}

export function createShortcutRegistry(overrides: Accessor<KeybindOverrides>) {
  const shortcuts: RegisteredShortcut[] = [];
  const [version, bumpVersion] = createSignal(0, { equals: false });

  function effectiveCombo(shortcut: RegisteredShortcut): ShortcutCombo | null {
    const current = overrides();
    return Object.hasOwn(current, shortcut.id) ? (current[shortcut.id] ?? null) : shortcut.combo;
  }

  function run(event: KeyboardEvent, manual: boolean): boolean {
    if (event.isComposing) return false;
    const typing = isTypingTarget(event.target);
    let winner: RegisteredShortcut | undefined;
    for (let index = shortcuts.length - 1; index >= 0; index -= 1) {
      const shortcut = defined(shortcuts[index]);
      if (Boolean(shortcut.manual) !== manual || !shortcut.enabled()) continue;
      if (typing && !(shortcut.allowInInputs ?? shortcut.target !== undefined)) continue;
      if (event.repeat && shortcut.allowRepeat === false) continue;
      if (shortcut.target && !(event.target instanceof Element && shortcut.target(event.target)))
        continue;
      const combo = effectiveCombo(shortcut);
      if (!(combo && matchesCombo(event, combo, shortcut.splitModifier))) continue;
      if (winner?.target && !shortcut.target) continue;
      winner = shortcut;
      if (shortcut.target) break;
    }
    if (!winner) return false;
    if (!winner.passthrough) event.preventDefault();
    winner.handler(event);
    return !winner.passthrough;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!event.defaultPrevented) run(event, false);
  }

  function list(): ShortcutInfo[] {
    version();
    const current = overrides();
    const latestById = new Map(shortcuts.map((shortcut) => [shortcut.id, shortcut]));
    return [...latestById.values()].map((shortcut) => {
      const isCustom = Object.hasOwn(current, shortcut.id);
      const combo = isCustom ? (current[shortcut.id] ?? null) : shortcut.combo;
      return {
        combo,
        defaultCombo: shortcut.combo,
        group: shortcut.group,
        id: shortcut.id,
        isCustom,
        keys: combo ? comboLabel(combo) : "Not set",
        label: shortcut.label,
        scope: shortcut.scope,
      };
    });
  }

  return {
    conflicts(id: string, combo: ShortcutCombo): ShortcutInfo[] {
      const all = list();
      const own = all.find((s) => s.id === id);
      return all.filter(
        (s) =>
          s.id !== id &&
          s.combo !== null &&
          combosOverlap(s.combo, combo) &&
          (!own || scopesOverlap(own.scope, s.scope)),
      );
    },
    dispatchManual: (event: KeyboardEvent) => run(event, true),
    dispose() {
      shortcuts.length = 0;
      document.removeEventListener("keydown", onKeyDown);
    },
    list,
    register(def: ShortcutDef): () => void {
      const shortcut: RegisteredShortcut = { ...def, enabled: def.enabled ?? (() => true) };
      if (shortcuts.length === 0) document.addEventListener("keydown", onKeyDown);
      shortcuts.push(shortcut);
      bumpVersion((v) => v + 1);
      return () => {
        const index = shortcuts.indexOf(shortcut);
        if (index >= 0) shortcuts.splice(index, 1);
        if (shortcuts.length === 0) document.removeEventListener("keydown", onKeyDown);
        bumpVersion((v) => v + 1);
      };
    },
  };
}
