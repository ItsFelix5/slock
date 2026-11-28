import { createSignal, getObserver, runWithOwner, type Signal } from "solid-js";
import type { ResourceCache } from "../cacheTypes";
import { stableKey } from "../key";
import type { EntryState } from "../state";

export interface CacheReader<K, T> {
  entry(key: K): EntryState<T>;
  peek(key: K): T | undefined;
  values(): T[];
}

interface CacheReaderOptions {
  ensure?: boolean;
}

const detached = <T>(create: () => T): T => runWithOwner(null, create) ?? create();

export function createCacheReader<K, T>(
  cache: ResourceCache<K, T>,
  options: CacheReaderOptions = {},
): CacheReader<K, T> {
  const { ensure = true } = options;
  const versions = new Map<string, Signal<number>>();
  const scheduled = new Set<string>();
  const any = detached(() => createSignal(0, { ownedWrite: true }));
  const bump = (signal: Signal<number> | undefined) => signal?.[1]((version) => version + 1);

  cache.onChange((key) => {
    bump(versions.get(stableKey(key)));
    bump(any);
  });

  const observe = (key: K, hash: string) => {
    let signal = versions.get(hash);
    if (!signal) {
      let release: (() => void) | undefined;
      let dropped = false;
      const unobserved = () => {
        dropped = true;
        versions.delete(hash);
        release?.();
      };
      signal = detached(() => createSignal(0, { ownedWrite: true, unobserved }));
      versions.set(hash, signal);
      queueMicrotask(() => {
        if (!dropped)
          release = cache.subscribe(key, () => {}, { enabled: ensure, retryFailed: false });
      });
    }
    signal[0]();
  };

  const needsLoad = (key: K, state: EntryState<T>) => {
    if (state.status === "idle") return true;
    if (state.status !== "ready" || state.refreshing) return false;
    return state.stale || cache.outdated(key);
  };

  const schedule = (key: K, hash: string) => {
    if (scheduled.has(hash)) return;
    scheduled.add(hash);
    queueMicrotask(() => {
      scheduled.delete(hash);
      if (needsLoad(key, cache.state(key))) cache.ensure(key).catch(() => {});
    });
  };

  const entry = (key: K) => {
    const hash = stableKey(key);
    if (getObserver()) observe(key, hash);
    const state = cache.state(key);
    if (ensure && needsLoad(key, state)) schedule(key, hash);
    return state;
  };

  return {
    entry,
    peek: (key) => entry(key).data,
    values: () => {
      any[0]();
      return cache.entries().flatMap(({ state }) => (state.data === undefined ? [] : [state.data]));
    },
  };
}
