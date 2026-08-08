import { createSignal } from "solid-js";

export type FeedbackKind = "success" | "error";

export interface Feedback {
  kind: FeedbackKind;
  text: string;
}

export function createKeyedFeedback(ttlMs = 3000) {
  const [state, setState] = createSignal<Record<string, Feedback>>({});
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function flash(key: string, text: string, kind: FeedbackKind = "success") {
    clearTimeout(timers.get(key));
    setState((s) => ({ ...s, [key]: { kind, text } }));
    timers.set(
      key,
      setTimeout(() => {
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
    clearTimeout(timers.get(key));
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
