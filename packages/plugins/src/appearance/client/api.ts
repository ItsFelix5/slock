import type { ThemeColorDefinition } from "@slock/ui";
import type { createTheme } from "@slock/ui";

declare module "@slock/core/types" {
  interface Points {
    "appearance.colors": ThemeColorDefinition[];
  }
  interface Services {
    theme: ReturnType<typeof createTheme>;
  }
}
