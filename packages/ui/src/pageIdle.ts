import { createSignal } from "solid-js";

const IDLE_AFTER_HIDDEN_MS = 30_000;

const [pageIdle, setPageIdle] = createSignal(false);
let idleTimer: ReturnType<typeof setTimeout> | undefined;

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    clearTimeout(idleTimer);
    if (document.visibilityState === "visible") setPageIdle(false);
    else idleTimer = setTimeout(() => setPageIdle(true), IDLE_AFTER_HIDDEN_MS);
  });
}

export { pageIdle };
