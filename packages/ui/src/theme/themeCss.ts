import type { Pref } from "@slock/core";
import { createSignal } from "solid-js";

export function createThemeCss(pref: Pref<string | null>, presetCss: string | undefined) {
  const customSheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, customSheet];
  const [themeCss, setThemeCssSignal] = createSignal(pref.get() ?? presetCss ?? "");
  customSheet.replaceSync(themeCss());

  function setThemeCss(value: string): void {
    setThemeCssSignal(value);
    customSheet.replaceSync(value);
    pref.set(value);
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
