import { type Accessor, createRoot, createSignal, untrack } from "solid-js";
import type { Host } from "./host";
import type { Points, Reactive, Services } from "./types";

export const solidReactive: Reactive = {
  scope: (fn) => createRoot((dispose) => ({ dispose, value: fn() })),
  signal: (initial) => {
    const [read, write] = createSignal(initial);
    return [read, (value) => write(() => value)];
  },
  untrack,
};

let current: Host | undefined;

export function setHost(host: Host) {
  current = host;
}

export function getHost(): Host {
  if (!current) throw new Error("host is not started");
  return current;
}

export function usePoint<P extends keyof Points>(point: P): Accessor<Points[P][]> {
  const host = getHost();
  return () => host.items(point);
}

export function service<K extends keyof Services>(key: K): Services[K] {
  const resolve = () => {
    const found = getHost().service(key);
    if (found === undefined) throw new Error(`service ${String(key)} is missing`);
    return found;
  };
  return new Proxy(Object.create(null) as Services[K], {
    get: (_target, property) => Reflect.get(new Object(resolve()), property),
    has: (_target, property) => Reflect.has(new Object(resolve()), property),
  });
}

export function maybeService<K extends keyof Services>(key: K): Accessor<Services[K] | undefined> {
  return () => getHost().service(key);
}
