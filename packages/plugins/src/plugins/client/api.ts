import type { Accessor, Component } from "solid-js";

export type PluginsService = {
  installed: Accessor<string[]>;
  serverOnly: Accessor<{ id: string; name?: string }[]>;
  install(file: File): Promise<void>;
  remove(id: string): Promise<void>;
};

export type PluginSettingsItem = {
  plugin: string;
  view: Component;
};

declare module "@slock/core/types" {
  interface Points {
    "plugins.settings": PluginSettingsItem;
  }
  interface Services {
    plugins: PluginsService;
  }
}
