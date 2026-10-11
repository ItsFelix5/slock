import type { Accessor } from "solid-js";

export type PluginsService = {
  installed: Accessor<string[]>;
  serverOnly: Accessor<{ id: string; name?: string }[]>;
  install(file: File): Promise<void>;
  remove(id: string): Promise<void>;
};

declare module "@slock/core/types" {
  interface Services {
    plugins: PluginsService;
  }
}
