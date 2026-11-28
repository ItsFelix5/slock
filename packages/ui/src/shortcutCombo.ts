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

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

const NAMED_KEYS: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Escape: "Esc",
  " ": "Space",
};

const CAPTURE_IGNORED_KEYS = new Set(["Alt", "AltGraph", "Control", "Meta", "OS", "Shift"]);

const FOREIGN_LETTER = /^(?![\p{Script=Latin}\p{Script=Common}])\p{L}$/u;
const SYMBOL = /^[^\p{L}\p{N} ]$/u;
const LETTER_CODE = /^Key([A-Z])$/;

function comboKeys(combo: ShortcutCombo): readonly string[] {
  return typeof combo.key === "string" ? [combo.key] : combo.key;
}

function normalizeKeys(key: string | readonly string[]): string[] {
  return comboKeys({ key }).map((k) => k.toLowerCase());
}

function modPressed(input: KeyInput, mac: boolean): boolean {
  return mac ? input.metaKey : input.ctrlKey;
}

function foreignModifierPressed(input: KeyInput, mac: boolean): boolean {
  return mac ? input.ctrlKey : input.metaKey;
}

function replacedByLayout(input: KeyInput, mac: boolean): boolean {
  const composing = input.altKey && (mac || !input.ctrlKey);
  if (!composing) return FOREIGN_LETTER.test(input.key);
  return input.key === "Dead" || (input.key.length === 1 && input.key.charCodeAt(0) > 127);
}

function physicalLetter(input: KeyInput, mac: boolean): string | undefined {
  const letter = LETTER_CODE.exec(input.code)?.[1];
  return letter && replacedByLayout(input, mac) ? letter.toLowerCase() : undefined;
}

function matchesPhysicalKey(input: KeyInput, key: string, mac: boolean): boolean {
  if (key === "/") return input.code === "Slash" && input.key !== "-";
  return physicalLetter(input, mac) === key.toLowerCase();
}

export function matchesCombo(
  input: KeyInput,
  combo: ShortcutCombo,
  splitModifier?: boolean,
  mac = isMac,
): boolean {
  if (foreignModifierPressed(input, mac)) return false;
  if (Boolean(combo.mod) !== modPressed(input, mac)) return false;
  if (Boolean(combo.alt) !== input.altKey) return false;
  return comboKeys(combo).some((key) => {
    const typed = input.key.toLowerCase() === key.toLowerCase();
    const layoutShift = typed && !combo.shift && SYMBOL.test(key);
    if (!(splitModifier || layoutShift) && Boolean(combo.shift) !== input.shiftKey) return false;
    return typed || matchesPhysicalKey(input, key, mac);
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
  if (CAPTURE_IGNORED_KEYS.has(input.key) || foreignModifierPressed(input, mac)) return null;
  const typed = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  const key = physicalLetter(input, mac) ?? typed;
  if (key === "Dead") return null;
  return {
    key,
    mod: modPressed(input, mac),
    shift: input.shiftKey,
    alt: input.altKey,
  };
}

export function typesText(combo: ShortcutCombo): boolean {
  return !(combo.mod || combo.alt) && comboKeys(combo).some((key) => key.length === 1);
}

export function combosOverlap(a: ShortcutCombo, b: ShortcutCombo): boolean {
  if (Boolean(a.mod) !== Boolean(b.mod)) return false;
  if (Boolean(a.shift) !== Boolean(b.shift)) return false;
  if (Boolean(a.alt) !== Boolean(b.alt)) return false;
  const bKeys = normalizeKeys(b.key);
  return normalizeKeys(a.key).some((key) => bKeys.includes(key));
}
