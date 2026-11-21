import type { PaneContentOf } from "@slock/plugins/shell/client/api/types";
import type { FileId } from "@slock/types";
import type { Component } from "solid-js";
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
    canvas: { fileId: FileId; title: string };
  }
}

declare module "@slock/core/types" {
  interface Points {
    "canvas.headerAction": Component<{ doc: CanvasDocModel | null; fileId: FileId }>;
  }

  interface Services {
    canvas: ReturnType<typeof createCanvasStore>;
  }
}
