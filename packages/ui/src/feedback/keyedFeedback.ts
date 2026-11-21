import { service } from "@slock/core/solid";
import type { TimerHandle } from "@slock/core/types";
import { createSignal } from "solid-js";

const env = service("env");

export type FeedbackKind = "success" | "error";

export interface Feedback {
  kind: FeedbackKind;
  text: string;
}

export function createKeyedFeedback(ttlMs = 3000) {
  const [state, setState] = createSignal<Record<string, Feedback>>({});
  const timers = new Map<string, TimerHandle>();

  function flash(key: string, text: string, kind: FeedbackKind = "success") {
    env.clearTimeout(timers.get(key));
    setState((s) => ({ ...s, [key]: { kind, text } }));
    timers.set(
      key,
      env.setTimeout(() => {
        timers.delete(key);
        setState((s) => {
          if (!(key in s)) return s;
          const next = { ...s };
          delete next[key];
          return next;
        });
      }, ttlMs),
    );
  }

  function clear(key: string) {
    env.clearTimeout(timers.get(key));
    timers.delete(key);
    setState((state) => {
      if (!(key in state)) return state;
      const next = { ...state };
      delete next[key];
      return next;
    });
  }

  function get(key: string): Feedback | undefined {
    return state()[key];
  }

  return { clear, flash, get };
}
