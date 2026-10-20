import type { Component } from "solid-js";
import type { PaneContentOf } from "../../shell/client/api/types";
import type { CanvasDocModel } from "./lib/canvasDelta";
import type { createCanvasStore } from "./store";

export type { CanvasDocModel } from "./lib/canvasDelta";
export {
  fetchCanvasComments,
  fetchCanvasRaw,
  fetchCanvasVersions,
  resolveCanvasFile,
} from "./lib/canvasRequests";
export type CanvasPaneContent = PaneContentOf<"canvas">;

declare module "../../shell/client/api/types" {
  interface PaneContents {
    canvas: { fileId: string; title: string };
  }
}

declare module "@slock/core/types" {
  interface Points {
    "canvas.headerAction": Component<{ doc: CanvasDocModel | null; fileId: string }>;
  }

  interface Services {
    canvas: ReturnType<typeof createCanvasStore>;
  }
}
