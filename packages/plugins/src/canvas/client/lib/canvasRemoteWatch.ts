import { createEffect, on, onCleanup } from "solid-js";
import { canvasTitle, canvasToOps } from "./canvasDelta";
import type { CanvasNames } from "./canvasEmbeds";
import type { LoadedCanvas } from "./canvasRequests";
import type { createCanvasSync } from "./canvasSync";

const REMOTE_CHECK_DELAY_MS = 1500;

export function watchRemoteChanges(options: {
  fetchLatest: () => Promise<LoadedCanvas | null>;
  isEditing: () => boolean;
  names: CanvasNames;
  onRemoteChange: (latest: LoadedCanvas) => void;
  remoteChangeTick: () => number;
  sync: ReturnType<typeof createCanvasSync>;
}) {
  const { sync } = options;
  const idle = () => !(sync.isPending() || options.isEditing());

  async function check() {
    if (!idle()) return;
    const latest = await options.fetchLatest();
    if (!(latest?.doc && idle())) return;
    const { doc } = latest;
    if (sync.differsFromRemote(canvasToOps(doc, options.names), canvasTitle(doc, options.names)))
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

  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    on(
      options.remoteChangeTick,
      () => {
        clearTimeout(checkTimer);
        checkTimer = setTimeout(() => void check(), REMOTE_CHECK_DELAY_MS);
      },
      { defer: true },
    ),
  );

  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("focus", onWindowFocus);
  document.addEventListener("visibilitychange", onVisibility);
  onCleanup(() => {
    clearTimeout(checkTimer);
    window.removeEventListener("beforeunload", beforeUnload);
    window.removeEventListener("focus", onWindowFocus);
    document.removeEventListener("visibilitychange", onVisibility);
    void sync.flush();
    sync.dispose();
  });
}
