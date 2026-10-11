declare module "virtual:plugins" {
  import type { PluginDef } from "@slock/core";

  const plugins: PluginDef[];
  export default plugins;
}
