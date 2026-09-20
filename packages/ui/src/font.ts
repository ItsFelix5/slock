import { createSignal } from "solid-js";

const FONT_KEY = "slock-theme-font";
const FONT_VAR = "--font";

function applyFont(value: string | undefined) {
  if (value) document.documentElement.style.setProperty(FONT_VAR, value);
  else document.documentElement.style.removeProperty(FONT_VAR);
}

const [font, setFontSignal] = createSignal<string | undefined>(
  localStorage.getItem(FONT_KEY) ?? undefined,
);
applyFont(font());

export { font };

export function setFont(value: string): void {
  setFontSignal(value);
  applyFont(value);
  localStorage.setItem(FONT_KEY, value);
}

export function resetFont(): void {
  setFontSignal(undefined);
  applyFont(undefined);
  localStorage.removeItem(FONT_KEY);
}

export function effectiveFont(): string {
  return font() ?? getComputedStyle(document.documentElement).getPropertyValue(FONT_VAR).trim();
}
