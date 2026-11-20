import { createFont } from "./font";
import { createThemeColors } from "./themeColors";
import { createThemeCss } from "./themeCss";
import { createThemeShape } from "./themeShape";

export function createTheme() {
  const { font, setFont } = createFont();
  const css = createThemeCss();
  const colors = createThemeColors({
    initThemeCss: css.initThemeCss,
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
