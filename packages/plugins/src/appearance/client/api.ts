import type { createTheme } from "./theme/createTheme";
import type { ThemeColorDefinition } from "./theme/themeColorRegistry";

declare module "@slock/core/types" {
  interface Points {
    "appearance.colors": ThemeColorDefinition[];
  }
  interface Services {
    theme: ReturnType<typeof createTheme>;
  }
}
