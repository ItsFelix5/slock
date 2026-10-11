import type { SlackFile } from "@slock/types";

declare module "@slock/core/types" {
  interface Services {
    files: { open(file: SlackFile): void };
  }
}
