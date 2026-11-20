import type { createKeybindOverrides } from "@slock/ui";

declare module "@slock/core/types" {
  interface Services {
    keybinds: ReturnType<typeof createKeybindOverrides>;
  }
}
