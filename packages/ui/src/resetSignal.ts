import { createSignal, type Setter } from "solid-js";

export function createResetSignal<T>(key: () => unknown, initial: T): [() => T, Setter<T>] {
  return createSignal<T>(() => {
    key();
    return initial;
  });
}
