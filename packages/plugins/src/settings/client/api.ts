import type { Accessor, Component } from "solid-js";

export type SettingsTabItem = {
  id: string;
  label: string;
  view: Component;
  visible?: Accessor<boolean>;
};

export type SettingsService = {
  isOpen: Accessor<boolean>;
  open(tab?: string): void;
  close(): void;
};

declare module "@slock/core/types" {
  interface Points {
    "settings.tab": SettingsTabItem;
  }
  interface Services {
    settings: SettingsService;
  }
}
