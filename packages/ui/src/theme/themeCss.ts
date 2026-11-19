import { createSignal } from "solid-js";

const THEME_CSS_KEY = "slock-theme-css";

const customSheet = new CSSStyleSheet();
document.adoptedStyleSheets = [...document.adoptedStyleSheets, customSheet];

const [themeCss, setThemeCssSignal] = createSignal(localStorage.getItem(THEME_CSS_KEY) ?? "");
customSheet.replaceSync(themeCss());

export { themeCss };

export function setThemeCss(value: string): void {
  setThemeCssSignal(value);
  customSheet.replaceSync(value);
  localStorage.setItem(THEME_CSS_KEY, value);
}

export function initThemeCss(presetCss: string | undefined): void {
  if (localStorage.getItem(THEME_CSS_KEY) === null) setThemeCss(presetCss ?? "");
}
