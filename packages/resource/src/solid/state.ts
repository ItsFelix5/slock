import { type Accessor, createEffect, createMemo, createSignal } from "solid-js";
import type { ResourceCache, SubscribeOptions } from "../cacheTypes";
import { stableKey } from "../key";
import { type EntryState, IDLE } from "../state";

function sameKey(a: unknown, b: unknown): boolean {
  return a === b || stableKey(a) === stableKey(b);
}

export function createStableKey<K>(key: Accessor<K | undefined>): Accessor<K | undefined> {
  return createMemo(() => key(), { equals: sameKey });
}

export function createCacheState<K, T>(
  cache: ResourceCache<K, T>,
  key: Accessor<K | undefined>,
  options?: SubscribeOptions,
): Accessor<EntryState<T>> {
  const stable = createStableKey(key);
  const [version, setVersion] = createSignal(0, { ownedWrite: true });
  const bump = () => setVersion((current) => current + 1);

  createEffect(stable, (current) => {
    if (current === undefined) return;
    const unsubscribe = cache.subscribe(current, bump, options);
    bump();
    return unsubscribe;
  });

  return createMemo(() => {
    version();
    const current = stable();
    return current === undefined ? IDLE : cache.state(current);
  });
}
