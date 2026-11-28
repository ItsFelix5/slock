import { createDebouncer, type Debouncer } from "@slock/core";
import { service } from "@slock/core/solid";
import { createSignal } from "solid-js";

const env = service("env");

type FeedbackKind = "success" | "error";

export interface Feedback {
  kind: FeedbackKind;
  text: string;
}

export function createKeyedFeedback(ttlMs = 3000) {
  const [state, setState] = createSignal<Record<string, Feedback>>({});
  const expiries = new Map<string, Debouncer<[]>>();

  function drop(key: string) {
    setState((s) => {
      if (!(key in s)) return s;
      const next = { ...s };
      delete next[key];
      return next;
    });
  }

  function expiry(key: string) {
    let timer = expiries.get(key);
    if (!timer) {
      timer = createDebouncer(env, () => drop(key), ttlMs);
      expiries.set(key, timer);
    }
    return timer;
  }

  function flash(key: string, text: string, kind: FeedbackKind = "success") {
    setState((s) => ({ ...s, [key]: { kind, text } }));
    expiry(key).schedule();
  }

  function clear(key: string) {
    expiries.get(key)?.cancel();
    drop(key);
  }

  function get(key: string): Feedback | undefined {
    return state()[key];
  }

  return { clear, flash, get };
}
