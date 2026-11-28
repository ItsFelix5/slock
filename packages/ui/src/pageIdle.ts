import { createDebouncer, type Env } from "@slock/core";
import { service } from "@slock/core/solid";
import { createSignal } from "solid-js";

const IDLE_AFTER_HIDDEN_MS = 30_000;

interface VisibilitySource {
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
  visibilityState: DocumentVisibilityState;
}

export function trackPageIdle(env: Env, source: VisibilitySource) {
  const [idle, setIdle] = createSignal(false);
  const goIdle = createDebouncer(env, () => setIdle(true), IDLE_AFTER_HIDDEN_MS);
  const onChange = () => {
    if (source.visibilityState === "visible") {
      goIdle.cancel();
      setIdle(false);
    } else goIdle.schedule();
  };
  source.addEventListener("visibilitychange", onChange);
  return {
    dispose() {
      goIdle.cancel();
      source.removeEventListener("visibilitychange", onChange);
    },
    idle,
  };
}

const ui = service("ui");

export const pageIdle = (): boolean => ui.pageIdle();
