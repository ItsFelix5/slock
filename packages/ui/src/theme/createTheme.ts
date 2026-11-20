import { createFont } from "./font";
import { createThemeColors, storedPreset } from "./themeColors";
import { createThemeCss } from "./themeCss";
import { createThemeShape } from "./themeShape";

export function createTheme() {
  const { font, setFont } = createFont();
  const css = createThemeCss(storedPreset().css);
  const colors = createThemeColors({
    setFont,
    setThemeCss: css.setThemeCss,
  });
  const shape = createThemeShape();
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
