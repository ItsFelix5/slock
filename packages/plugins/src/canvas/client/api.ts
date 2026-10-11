import type { PaneContentOf } from "../../shell/client/api/types";
import type { createCanvasStore } from "./store";

export type CanvasPaneContent = PaneContentOf<"canvas">;

declare module "../../shell/client/api/types" {
  interface PaneContents {
    canvas: { fileId: string; title: string };
  }
}

declare module "@slock/core/types" {
  interface Services {
    canvas: ReturnType<typeof createCanvasStore>;
  }
}
