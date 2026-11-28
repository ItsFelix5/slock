import type { Host } from "./host/host";
import type { Services } from "./types";

let current: Host | undefined;

export function setHost(host: Host) {
  current = host;
}

export function getHost(): Host {
  if (!current) throw new Error("host is not started");
  return current;
}

export function service<K extends keyof Services>(key: K): Services[K] {
  const resolve = () => {
    const found = getHost().peek(key);
    if (found === undefined) throw new Error(`service ${String(key)} is missing`);
    return found;
  };
  const target: Services[K] & object = Object.create(null);
  return new Proxy(target, {
    get: (_target, property) => Reflect.get(new Object(resolve()), property),
    has: (_target, property) => Reflect.has(new Object(resolve()), property),
  });
}
