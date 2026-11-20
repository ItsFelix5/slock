import { createSignal } from "solid-js";

const THEME_CSS_KEY = "slock-theme-css";

export function createThemeCss(presetCss: string | undefined) {
  const customSheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, customSheet];
  const [themeCss, setThemeCssSignal] = createSignal(
    localStorage.getItem(THEME_CSS_KEY) ?? presetCss ?? "",
  );
  customSheet.replaceSync(themeCss());

  function setThemeCss(value: string): void {
    setThemeCssSignal(value);
    customSheet.replaceSync(value);
    localStorage.setItem(THEME_CSS_KEY, value);
  }

  return {
    dispose: () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (sheet) => sheet !== customSheet,
      );
    },
    setThemeCss,
    themeCss,
  };
}
