import { onCleanup } from "solid-js";
import type { LoadedCanvas } from "../api";
import { canvasTitle, canvasToOps } from "./canvasDelta";
import type { CanvasNames } from "./canvasEmbeds";
import type { createCanvasSync } from "./canvasSync";

export function watchRemoteChanges(options: {
  fetchLatest: () => Promise<LoadedCanvas | null>;
  isEditing: () => boolean;
  names: CanvasNames;
  onRemoteChange: (latest: LoadedCanvas) => void;
  sync: ReturnType<typeof createCanvasSync>;
}) {
  const { sync } = options;
  const idle = () => !(sync.isPending() || options.isEditing());

  async function check() {
    if (!idle()) return;
    const latest = await options.fetchLatest();
    if (!(latest?.doc && idle())) return;
    if (sync.differsFromRemote(canvasToOps(latest.doc, options.names), canvasTitle(latest.doc)))
      options.onRemoteChange(latest);
  }

  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (sync.isPending()) event.preventDefault();
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") void sync.flush();
    else void check();
  };
  const onWindowFocus = () => void check();

  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("focus", onWindowFocus);
  document.addEventListener("visibilitychange", onVisibility);
  onCleanup(() => {
    window.removeEventListener("beforeunload", beforeUnload);
    window.removeEventListener("focus", onWindowFocus);
    document.removeEventListener("visibilitychange", onVisibility);
    void sync.flush();
    sync.dispose();
  });
}
