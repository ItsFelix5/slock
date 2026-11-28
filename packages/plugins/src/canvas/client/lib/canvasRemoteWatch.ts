import { service, useDebouncer } from "@slock/core/solid";
import type { FileId } from "@slock/types";
import { createEffect, onCleanup } from "solid-js";
import type { createCanvasSync } from "./canvasSync";

const env = service("env");
const realtime = service("realtime");

const REMOTE_CHECK_DELAY_MS = 100;
const REMOTE_POLL_MS = 60_000;

// A refresh aborts the one in flight, so a busy canvas would otherwise never finish loading.
function oneAtATime(run: () => Promise<unknown>) {
  let running = false;
  let again = false;
  return async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    do {
      again = false;
      await run();
    } while (again);
    running = false;
  };
}

export function watchRemoteChanges(options: {
  fileId: FileId;
  refresh: () => Promise<unknown>;
  remoteChangeTick: () => number;
  sync: ReturnType<typeof createCanvasSync>;
}) {
  const { refresh, sync } = options;

  const pull = oneAtATime(refresh);
  const delayedRefresh = useDebouncer(() => void pull(), REMOTE_CHECK_DELAY_MS);
  const check = () => delayedRefresh.schedule();
  createEffect(options.remoteChangeTick, check, { defer: true });

  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (sync.isPending()) event.preventDefault();
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") void sync.flush();
    else check();
  };

  const pollTimer = env.setInterval(() => {
    if (document.visibilityState === "visible") check();
  }, REMOTE_POLL_MS);

  const unwatch = realtime.watchFile(options.fileId);
  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", onVisibility);
  onCleanup(() => {
    unwatch();
    env.clearInterval(pollTimer);
    window.removeEventListener("beforeunload", beforeUnload);
    window.removeEventListener("focus", check);
    document.removeEventListener("visibilitychange", onVisibility);
  });
}
