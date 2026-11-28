import { defined } from "@slock/core";
import { type Accessor, createSignal } from "solid-js";
import type { KeybindOverrides } from "../keybindOverrides";
import {
  comboLabel,
  combosOverlap,
  matchesCombo,
  type ShortcutCombo,
  typesText,
} from "../shortcutCombo";

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

type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

type ShortcutScope = "general" | "composer" | "lists" | "messages";

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

export type ShortcutSpec = Pick<ShortcutDef, "combo" | "group" | "id" | "label" | "scope">;

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

export function isTypingTarget(target: EventTarget | null) {
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

function actsOnPage(shortcut: ShortcutDef): boolean {
  return shortcut.scope === "messages" || shortcut.group === "Channels and search";
}

export function createShortcutRegistry(
  overrides: Accessor<KeybindOverrides>,
  dialogOpen: () => boolean,
) {
  const shortcuts: RegisteredShortcut[] = [];
  const declared: ShortcutSpec[] = [];
  const [version, bumpVersion] = createSignal(0, { equals: false, ownedWrite: true });

  function effectiveCombo(shortcut: RegisteredShortcut): ShortcutCombo | null {
    const current = overrides();
    return Object.hasOwn(current, shortcut.id) ? (current[shortcut.id] ?? null) : shortcut.combo;
  }

  function repeats(shortcut: RegisteredShortcut): boolean {
    const combo = effectiveCombo(shortcut);
    return shortcut.allowRepeat ?? !(combo && typesText(combo));
  }

  function run(event: KeyboardEvent, manual: boolean): boolean {
    if (event.isComposing) return false;
    const typing = isTypingTarget(event.target);
    let winner: RegisteredShortcut | undefined;
    for (let index = shortcuts.length - 1; index >= 0; index -= 1) {
      const shortcut = defined(shortcuts[index]);
      if (Boolean(shortcut.manual) !== manual || !shortcut.enabled()) continue;
      if (actsOnPage(shortcut) && dialogOpen()) continue;
      if (typing && !(shortcut.allowInInputs ?? shortcut.target !== undefined)) continue;
      if (shortcut.target && !(event.target instanceof Element && shortcut.target(event.target)))
        continue;
      const combo = effectiveCombo(shortcut);
      if (!(combo && matchesCombo(event, combo, shortcut.splitModifier))) continue;
      if (typing && typesText(combo)) continue;
      if (winner?.target && !shortcut.target) continue;
      winner = shortcut;
      if (shortcut.target) break;
    }
    if (!winner) return false;
    if (!winner.passthrough) event.preventDefault();
    if (!event.repeat || repeats(winner)) winner.handler(event);
    return !winner.passthrough;
  }

  function dispatch(event: KeyboardEvent) {
    if (!event.defaultPrevented) run(event, false);
  }

  function list(): ShortcutInfo[] {
    version();
    const current = overrides();
    const known = [...declared, ...shortcuts];
    const latestById = new Map(known.map((shortcut) => [shortcut.id, shortcut]));
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
    declare(specs: readonly ShortcutSpec[]): () => void {
      declared.push(...specs);
      bumpVersion((v) => v + 1);
      return () => {
        for (const spec of specs) {
          const index = declared.indexOf(spec);
          if (index >= 0) declared.splice(index, 1);
        }
        bumpVersion((v) => v + 1);
      };
    },
    dispatch,
    dispatchManual: (event: KeyboardEvent) => run(event, true),
    dispose() {
      shortcuts.length = 0;
      declared.length = 0;
      document.removeEventListener("keydown", dispatch);
    },
    list,
    register(def: ShortcutDef): () => void {
      const shortcut: RegisteredShortcut = { ...def, enabled: def.enabled ?? (() => true) };
      if (shortcuts.length === 0) document.addEventListener("keydown", dispatch);
      shortcuts.push(shortcut);
      bumpVersion((v) => v + 1);
      return () => {
        const index = shortcuts.indexOf(shortcut);
        if (index >= 0) shortcuts.splice(index, 1);
        if (shortcuts.length === 0) document.removeEventListener("keydown", dispatch);
        bumpVersion((v) => v + 1);
      };
    },
  };
}
