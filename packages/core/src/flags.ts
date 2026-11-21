import { createOptimisticStore, createStore } from "solid-js";

export function createFlags<Key extends string>() {
  const [flags, setFlags] = createStore<Record<string, boolean>>({});
  return {
    has: (key: Key) => !!flags[key],
    set: (key: Key, value: boolean) =>
      setFlags((draft) => {
        draft[key] = value;
      }),
  };
}

export function createOptimisticFlags<Key extends string>() {
  const base = createFlags<Key>();
  const [held, setHeld] = createOptimisticStore<Record<string, boolean>>({});
  return {
    has: (key: Key) => held[key] ?? base.has(key),
    hold: (key: Key, value: boolean) =>
      setHeld((draft) => {
        draft[key] = value;
      }),
    set: base.set,
  };
}
