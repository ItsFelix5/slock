import type { PaneContentOf } from "@slock/plugins/shell/client/api/types";

export type DebugPaneContent = PaneContentOf<"debug">;

declare module "../../shell/client/api/types" {
  interface PaneContents {
    debug: { entity: string; id: string };
  }
}
