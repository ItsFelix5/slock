import type { Env } from "@slock/core";
import { createFont } from "./font";
import { createThemeColors, storedPreset } from "./themeColors";
import { createThemeCss } from "./themeCss";
import { createThemePrefs } from "./themePrefs";
import { createThemeShape } from "./themeShape";

export function createTheme(storage: Env["storage"]) {
  const prefs = createThemePrefs(storage);
  const { font, setFont } = createFont(prefs.font);
  const css = createThemeCss(prefs.css, storedPreset(prefs.preset).css);
  const colors = createThemeColors(
    {
      setFont,
      setThemeCss: css.setThemeCss,
    },
    prefs,
  );
  const shape = createThemeShape(prefs.shape);
  return {
    ...colors,
    dispose: () => {
      colors.dispose();
      css.dispose();
    },
    font,
    setFont,
    setThemeCss: css.setThemeCss,
    setThemeShape: shape.setThemeShape,
    themeCss: css.themeCss,
    themeShape: shape.themeShape,
  };
}
