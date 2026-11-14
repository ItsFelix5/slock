import { createSignal } from "solid-js";

const IDLE_AFTER_HIDDEN_MS = 30_000;

interface VisibilitySource {
  addEventListener(type: "visibilitychange", listener: () => void): void;
  visibilityState: DocumentVisibilityState;
}

export function trackPageIdle(source: VisibilitySource) {
  const [idle, setIdle] = createSignal(false);
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  source.addEventListener("visibilitychange", () => {
    clearTimeout(idleTimer);
    if (source.visibilityState === "visible") setIdle(false);
    else idleTimer = setTimeout(() => setIdle(true), IDLE_AFTER_HIDDEN_MS);
  });
  return idle;
}

export const pageIdle = typeof document === "undefined" ? () => false : trackPageIdle(document);
