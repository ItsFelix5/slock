import type { createSlashCommandsStore } from "./store";

declare module "@slock/core/types" {
  interface Services {
    "slash-commands": ReturnType<typeof createSlashCommandsStore>;
  }
}

export function composerFeedbackKey(key: string): string {
  return `composer:${key}`;
}
