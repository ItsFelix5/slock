import { type Accessor, createSignal, onCleanup, onMount } from "solid-js";

export type ShortcutScope = "general" | "composer" | "messages";

export interface ShortcutDef {
  match: (e: KeyboardEvent) => boolean;
  handler: (e: KeyboardEvent) => void;
  enabled?: Accessor<boolean>;
  // Global shortcuts are ignored while typing in an input/textarea/contenteditable
  // by default — set true for shortcuts (like Ctrl+K) meant to work everywhere.
  allowInInputs?: boolean;
  // Most shortcuts (arrow-key navigation) should keep firing while the key is
  // held; toggles like Ctrl+/ set this false to only react to the initial press.
  allowRepeat?: boolean;
  label: string;
  keys: string;
  scope: ShortcutScope;
}

interface RegisteredShortcut extends ShortcutDef {
  enabled: Accessor<boolean>;
}

const shortcuts: RegisteredShortcut[] = [];
const [registryVersion, bumpRegistryVersion] = createSignal(0, { equals: false });

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  const typing = isTypingTarget(event.target);
  for (let index = shortcuts.length - 1; index >= 0; index -= 1) {
    const shortcut = shortcuts[index];
    if (!shortcut.enabled()) continue;
    if (typing && !shortcut.allowInInputs) continue;
    if (event.repeat && shortcut.allowRepeat === false) continue;
    if (!shortcut.match(event)) continue;
    event.preventDefault();
    shortcut.handler(event);
    return;
  }
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

// Reactive so a help overlay can render the live set of currently-mounted
// shortcuts instead of a hand-maintained list that can drift out of sync.
export function shortcutsByScope(): Map<ShortcutScope, ShortcutDef[]> {
  registryVersion();
  const byScope = new Map<ShortcutScope, ShortcutDef[]>();
  for (const shortcut of shortcuts) {
    const list = byScope.get(shortcut.scope);
    if (list) list.push(shortcut);
    else byScope.set(shortcut.scope, [shortcut]);
  }
  return byScope;
}
