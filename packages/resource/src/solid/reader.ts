import { createSignal, runWithOwner, type Signal } from "solid-js";
import type { ResourceCache } from "../cacheTypes";
import { stableKey } from "../key";
import type { EntryState } from "../state";

export interface CacheReader<K, T> {
  entry(key: K): EntryState<T>;
  peek(key: K): T | undefined;
}

export interface CacheReaderOptions {
  ensure?: boolean;
}

export function createCacheReader<K, T>(
  cache: ResourceCache<K, T>,
  options: CacheReaderOptions = {},
): CacheReader<K, T> {
  const { ensure = true } = options;
  const versions = new Map<string, Signal<number>>();
  const scheduled = new Set<string>();

  cache.onChange((key, state) => {
    const hash = stableKey(key);
    versions.get(hash)?.[1]((version) => version + 1);
    if (state.status === "idle") versions.delete(hash);
  });

  const track = (hash: string) => {
    let signal = versions.get(hash);
    if (!signal) {
      signal = runWithOwner(null, () => createSignal(0)) ?? createSignal(0);
      versions.set(hash, signal);
    }
    signal[0]();
  };

  const schedule = (key: K, hash: string) => {
    if (scheduled.has(hash)) return;
    scheduled.add(hash);
    queueMicrotask(() => {
      scheduled.delete(hash);
      if (cache.state(key).status === "idle") cache.ensure(key).catch(() => {});
    });
  };

  const entry = (key: K) => {
    const hash = stableKey(key);
    track(hash);
    const state = cache.state(key);
    if (ensure && state.status === "idle") schedule(key, hash);
    return state;
  };

  return { entry, peek: (key) => entry(key).data };
}
