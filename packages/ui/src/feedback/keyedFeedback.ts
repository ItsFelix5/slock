import { createSignal } from "solid-js";

export type FeedbackKind = "success" | "error";

export interface Feedback {
  text: string;
  kind: FeedbackKind;
}

// A per-key replacement for a global toast stack: async actions (usually store
// mutations keyed by the entity they act on, e.g. a channel or message id) flash
// a short-lived message here instead, and whichever row/panel renders that entity
// picks it up with `get(key)` and shows it inline, right next to what changed.
export function createKeyedFeedback(ttlMs = 3000) {
  const [state, setState] = createSignal<Record<string, Feedback>>({});
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function flash(key: string, text: string, kind: FeedbackKind = "success") {
    clearTimeout(timers.get(key));
    setState((s) => ({ ...s, [key]: { text, kind } }));
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

  function get(key: string): Feedback | undefined {
    return state()[key];
  }

  return { flash, get };
}
