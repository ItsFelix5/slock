export interface ShortcutCombo {
  key: string | readonly string[];
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export type KeyInput = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

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

function modPressed(input: KeyInput, mac: boolean): boolean {
  return mac ? input.metaKey : input.ctrlKey;
}

export function matchesCombo(
  input: KeyInput,
  combo: ShortcutCombo,
  splitModifier?: boolean,
  mac = isMac,
): boolean {
  if (Boolean(combo.mod) !== modPressed(input, mac)) return false;
  if (!splitModifier && Boolean(combo.shift) !== input.shiftKey) return false;
  if (Boolean(combo.alt) !== input.altKey) return false;
  return comboKeys(combo).some((key) => {
    if (input.key.toLowerCase() === key.toLowerCase()) return true;
    const fallbackCode = CODE_FALLBACK[key];
    return fallbackCode !== undefined && input.code === fallbackCode;
  });
}

function keyLabel(key: string, uppercase: boolean): string {
  const named = NAMED_KEYS[key];
  if (named) return named;
  return key.length === 1 ? (uppercase ? key.toUpperCase() : key.toLowerCase()) : key;
}

export function comboParts(combo: ShortcutCombo, mac = isMac): string[] {
  const hasModifier = Boolean(combo.mod || combo.shift || combo.alt);
  const parts: string[] = [];
  if (combo.mod) parts.push(mac ? "⌘" : "Ctrl");
  if (combo.shift) parts.push("Shift");
  if (combo.alt) parts.push("Alt");
  parts.push(
    comboKeys(combo)
      .map((key) => keyLabel(key, hasModifier))
      .join(" / "),
  );
  return parts;
}

export function comboLabel(combo: ShortcutCombo, mac = isMac): string {
  return comboParts(combo, mac).join(" ");
}

export function comboFromEvent(input: KeyInput, mac = isMac): ShortcutCombo | null {
  if (CAPTURE_IGNORED_KEYS.has(input.key)) return null;
  return {
    key: input.key.length === 1 ? input.key.toLowerCase() : input.key,
    mod: modPressed(input, mac),
    shift: input.shiftKey,
    alt: input.altKey,
  };
}

export function combosOverlap(a: ShortcutCombo, b: ShortcutCombo): boolean {
  if (Boolean(a.mod) !== Boolean(b.mod)) return false;
  if (Boolean(a.shift) !== Boolean(b.shift)) return false;
  if (Boolean(a.alt) !== Boolean(b.alt)) return false;
  const bKeys = normalizeKeys(b.key);
  return normalizeKeys(a.key).some((key) => bKeys.includes(key));
}
