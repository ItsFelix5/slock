import { createEffect, onCleanup } from "solid-js";
import { canvasTitle, canvasToOps } from "./canvasDelta";
import type { CanvasNames } from "./canvasEmbeds";
import type { LoadedCanvas } from "./canvasRequests";
import type { createCanvasSync } from "./canvasSync";

const REMOTE_CHECK_DELAY_MS = 1500;
const REMOTE_POLL_MS = 10_000;

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

  let skipped = false;

  async function check() {
    skipped = !idle();
    if (skipped) return;
    const latest = await options.fetchLatest();
    if (!latest?.doc) return;
    if (!idle()) {
      skipped = true;
      return;
    }
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
  const scheduleCheck = (delay: number) => {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(() => void check(), delay);
  };
  createEffect(options.remoteChangeTick, () => scheduleCheck(REMOTE_CHECK_DELAY_MS), {
    defer: true,
  });
  const onFocusOut = () => {
    if (skipped) scheduleCheck(REMOTE_CHECK_DELAY_MS);
  };

  const pollTimer = setInterval(() => {
    if (document.visibilityState === "visible") void check();
  }, REMOTE_POLL_MS);

  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("focus", onWindowFocus);
  document.addEventListener("focusout", onFocusOut);
  document.addEventListener("visibilitychange", onVisibility);
  onCleanup(() => {
    clearTimeout(checkTimer);
    clearInterval(pollTimer);
    window.removeEventListener("beforeunload", beforeUnload);
    window.removeEventListener("focus", onWindowFocus);
    document.removeEventListener("focusout", onFocusOut);
    document.removeEventListener("visibilitychange", onVisibility);
    void sync.flush();
    sync.dispose();
  });
}
