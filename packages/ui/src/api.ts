import type { Ui } from "./ui";

declare module "@slock/core/types" {
  interface Services {
    ui: Ui;
  }
}
