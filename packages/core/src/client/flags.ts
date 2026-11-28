import { createStore } from "solid-js";

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
