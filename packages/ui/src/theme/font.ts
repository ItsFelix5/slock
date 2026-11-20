import { createSignal } from "solid-js";

export const DEFAULT_FONT = '"Lato", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const GEIST_FONT = '"Geist", "Helvetica Neue", Helvetica, Arial, sans-serif';

const FONT_KEY = "slock-theme-font";
const FONT_VAR = "--font";

function applyFont(value: string) {
  document.documentElement.style.setProperty(FONT_VAR, value);
}

export function createFont() {
  const [font, setFontSignal] = createSignal(localStorage.getItem(FONT_KEY) ?? DEFAULT_FONT);
  applyFont(font());
  return {
    font,
    setFont(value: string): void {
      const next = value.trim() || DEFAULT_FONT;
      setFontSignal(next);
      applyFont(next);
      localStorage.setItem(FONT_KEY, next);
    },
  };
}
