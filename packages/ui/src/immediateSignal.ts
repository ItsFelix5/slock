import { createSignal } from "solid-js";

export function createImmediateSignal<T>(initial: T): [get: () => T, set: (next: T) => void] {
  let current = initial;
  const [tracked, setTracked] = createSignal({ value: initial }, { ownedWrite: true });
  return [
    () => {
      tracked();
      return current;
    },
    (next) => {
      current = next;
      setTracked({ value: next });
    },
  ];
}
