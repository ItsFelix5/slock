import type { CacheOptions, ResourceCache } from "./cacheTypes";
import { ResourceCleared } from "./cacheTypes";
import { createCooldown } from "./cooldown";
import { deferred } from "./deferred";
import { createEntry, deriveState, type Entry, isFresh } from "./entry";
import { type FetchDeps, runFetch } from "./fetchRun";
import { stableKey } from "./key";
import { createPersistence } from "./persistence";
import { type EntryState, IDLE } from "./state";

export function createResourceCache<K, T>(options: CacheOptions<K, T>): ResourceCache<K, T> {
  const { env } = options;
  const gcMs = options.gcMs ?? 120_000;
  const defaultMaxAgeMs = options.maxAgeMs ?? Number.POSITIVE_INFINITY;
  const dedupeMs = options.dedupeMs ?? 0;
  const maxAutoFailures = options.maxAutoFailures ?? Number.POSITIVE_INFINITY;
  const entries = new Map<string, Entry<K, T>>();
  const observers = new Set<(key: K, state: EntryState<T>) => void>();

  const isFreshFor = (entry: Entry<K, T>, maxAgeMs = defaultMaxAgeMs) =>
    isFresh(entry, env.now(), Math.max(maxAgeMs, dedupeMs));

  function discard(entry: Entry<K, T>) {
    if (entry.gc !== undefined) env.clearTimeout(entry.gc);
    entry.gc = undefined;
    entries.delete(entry.hash);
  }

  function isInactive(entry: Entry<K, T>) {
    return entry.listeners.size === 0 && entry.inflight === undefined;
  }

  function scheduleGc(entry: Entry<K, T>) {
    if (entry.gc !== undefined) env.clearTimeout(entry.gc);
    entry.gc = isInactive(entry) ? env.setTimeout(() => discard(entry), gcMs) : undefined;
  }

  function publish(entry: Entry<K, T>) {
    entry.state = deriveState(entry);
    scheduleGc(entry);
    for (const listener of entry.listeners) listener(entry.state);
    for (const observer of observers) observer(entry.key, entry.state);
  }

  function obtain(key: K) {
    const hash = stableKey(key);
    const existing = entries.get(hash);
    if (existing) return existing;
    const entry = createEntry<K, T>(key, hash);
    entries.set(hash, entry);
    scheduleGc(entry);
    return entry;
  }

  function stopFetch(entry: Entry<K, T>) {
    entry.inflight?.controller.abort();
    entry.inflight = undefined;
    entry.idle?.resolve();
    entry.idle = undefined;
  }

  const fetchDeps: FetchDeps<K, T> = {
    cooldown: options.cooldown ?? createCooldown(env),
    env,
    load: options.load,
    onFailure: (entry, error) => {
      stopFetch(entry);
      entry.error = { value: error };
      entry.failures++;
      publish(entry);
    },
    onSuccess: (entry, data) => {
      stopFetch(entry);
      store(entry, { value: data }, env.now());
      entry.stale = false;
      publish(entry);
    },
    retry: options.retry ?? {},
  };

  const persistence = options.persist
    ? createPersistence({
        env,
        hydrate: (key, data, at) => {
          const entry = obtain(key);
          if (entry.box) return;
          entry.box = { value: data };
          entry.dataAt = at;
          entry.stale = true;
          publish(entry);
        },
        options: options.persist,
        *ready() {
          for (const { box, dataAt, key } of entries.values())
            if (box) yield { at: dataAt, data: box.value, key };
        },
      })
    : undefined;

  function store(entry: Entry<K, T>, box: Entry<K, T>["box"], at: number) {
    entry.box = box;
    entry.dataAt = at;
    entry.error = undefined;
    entry.failures = 0;
    persistence?.schedule();
  }

  function startFetch(entry: Entry<K, T>) {
    entry.inflight?.controller.abort();
    const inflight = { controller: new AbortController() };
    entry.inflight = inflight;
    entry.idle ??= deferred();
    if (!entry.box) entry.error = undefined;
    publish(entry);
    void runFetch(fetchDeps, entry, inflight);
  }

  async function settle(entry: Entry<K, T>): Promise<T> {
    while (entry.idle) await entry.idle.promise;
    if (entry.error) throw entry.error.value;
    if (entry.box) return entry.box.value;
    throw new ResourceCleared();
  }

  function replace(entry: Entry<K, T>, box: Entry<K, T>["box"], at: number) {
    stopFetch(entry);
    store(entry, box, at);
    publish(entry);
  }

  function markStale(entry: Entry<K, T>) {
    entry.stale = true;
    if (isInactive(entry)) publish(entry);
    else startFetch(entry);
  }

  function reset(entry: Entry<K, T>) {
    stopFetch(entry);
    entry.box = undefined;
    entry.error = undefined;
    entry.failures = 0;
    entry.stale = false;
    publish(entry);
    if (entry.listeners.size === 0) discard(entry);
  }

  const cache: ResourceCache<K, T> = {
    clear: () => {
      for (const entry of [...entries.values()]) reset(entry);
    },
    dispose: () => {
      persistence?.stop();
      for (const entry of entries.values()) {
        stopFetch(entry);
        if (entry.gc !== undefined) env.clearTimeout(entry.gc);
      }
      entries.clear();
      observers.clear();
    },
    ensure: (key, ensureOptions) => {
      const entry = obtain(key);
      if (entry.box && isFreshFor(entry, ensureOptions?.maxAgeMs))
        return Promise.resolve(entry.box.value);
      if (!entry.inflight) startFetch(entry);
      return settle(entry);
    },
    evictInactive: () => {
      for (const entry of [...entries.values()]) if (isInactive(entry)) discard(entry);
    },
    invalidate: (key) => {
      const entry = entries.get(stableKey(key));
      if (entry) markStale(entry);
    },
    invalidateWhere: (match) => {
      for (const entry of [...entries.values()]) if (match(entry.key)) markStale(entry);
    },
    onChange: (listener) => {
      observers.add(listener);
      return () => observers.delete(listener);
    },
    patch: (key, update) => {
      const entry = obtain(key);
      const { box, dataAt } = entry;
      replace(entry, { value: update(box?.value) }, env.now());
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        replace(entry, box, dataAt);
      };
    },
    read: (key) => entries.get(stableKey(key))?.box?.value,
    refresh: (key) => {
      const entry = obtain(key);
      startFetch(entry);
      return settle(entry);
    },
    remove: (key) => {
      const entry = entries.get(stableKey(key));
      if (entry) reset(entry);
    },
    restore: async () => {
      await persistence?.restore();
    },
    set: (key, data) => {
      const entry = obtain(key);
      entry.stale = false;
      replace(entry, { value: data }, env.now());
    },
    state: (key) => entries.get(stableKey(key))?.state ?? IDLE,
    subscribe: (key, listener, subscribeOptions) => {
      const entry = obtain(key);
      entry.listeners.add(listener);
      scheduleGc(entry);
      const wantsFetch =
        subscribeOptions?.enabled !== false &&
        !entry.inflight &&
        !isFreshFor(entry, subscribeOptions?.maxAgeMs) &&
        entry.failures < maxAutoFailures;
      if (wantsFetch) startFetch(entry);
      return () => {
        entry.listeners.delete(listener);
        scheduleGc(entry);
      };
    },
  };
  return cache;
}
