import { type Accessor, createRoot, createSignal, flush, runWithOwner, untrack } from "solid-js";
import { getHost } from "../services";
import type { Points, Reactive, Services } from "../types";

export const solidReactive: Reactive = {
  scope: (fn) => createRoot((dispose) => ({ dispose, value: fn() })),
  signal: (initial) => {
    const [read, write] = createSignal<typeof initial>(() => initial, { ownedWrite: true });
    return [
      read,
      (value) => {
        write(() => value);
        runWithOwner(null, flush);
      },
    ];
  },
  untrack,
};

export function usePoint<P extends keyof Points>(point: P): Accessor<Points[P][]> {
  const host = getHost();
  return () => host.items(point);
}

export function maybeService<K extends keyof Services>(key: K): Accessor<Services[K] | undefined> {
  return () => getHost().service(key);
}
