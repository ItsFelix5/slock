import { type Accessor, createMemo } from "solid-js";
import type { ResourceCache, SubscribeOptions } from "../cacheTypes";
import { createCacheState, createStableKey } from "./state";

export function createCacheValue<K, T>(
  cache: ResourceCache<K, T>,
  key: Accessor<K | undefined>,
  options?: SubscribeOptions,
): Accessor<T | undefined> {
  const stable = createStableKey(key);
  const state = createCacheState(cache, stable, options);

  return createMemo(() => {
    const current = stable();
    if (current === undefined) return undefined;
    const snapshot = state();
    if (snapshot.status === "ready") return snapshot.data;
    if (snapshot.status === "error") {
      return snapshot.data === undefined ? Promise.reject(snapshot.error) : snapshot.data;
    }
    return Promise.resolve().then(() => cache.ensure(current));
  });
}
