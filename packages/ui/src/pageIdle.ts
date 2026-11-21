import type { Env, TimerHandle } from "@slock/core";
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
  let idleTimer: TimerHandle | undefined;
  const onChange = () => {
    env.clearTimeout(idleTimer);
    if (source.visibilityState === "visible") setIdle(false);
    else idleTimer = env.setTimeout(() => setIdle(true), IDLE_AFTER_HIDDEN_MS);
  };
  source.addEventListener("visibilitychange", onChange);
  return {
    dispose() {
      env.clearTimeout(idleTimer);
      source.removeEventListener("visibilitychange", onChange);
    },
    idle,
  };
}

const ui = service("ui");

export const pageIdle = (): boolean => ui.pageIdle();
