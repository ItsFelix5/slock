import type { CacheOptions, ResourceCache } from "./cacheTypes";
import { ResourceCleared } from "./cacheTypes";
import { createCooldown } from "./cooldown";
import { deferred } from "./deferred";
import { createEntry, derive, type Entry, isFresh, isInactive } from "./entry";
import { createEntryTimer } from "./entryTimer";
import { createRequests, type FetchDeps, runFetch } from "./fetchRun";
import { stableKey } from "./key";
import { createPersistence } from "./persistence";
import { share } from "./share";
import { type EntryState, IDLE } from "./state";

export function createResourceCache<K, T>(options: CacheOptions<K, T>): ResourceCache<K, T> {
  const { env, maxAgeMs: maxAge = Number.POSITIVE_INFINITY } = options;
  const gcMs = options.gcMs ?? 120_000;
  const dedupeMs = options.dedupeMs ?? 0;
  const cooldown = options.cooldown ?? createCooldown(env);
  const requests = createRequests({ cooldown, env, retry: options.retry ?? {} });
  const maxAutoFailures = options.maxAutoFailures ?? Number.POSITIVE_INFINITY;
  const entries = new Map<string, Entry<K, T>>();
  const observers = new Set<(key: K, state: EntryState<T>) => void>();

  const maxAgeOf = ({ box }: Entry<K, T>) =>
    typeof maxAge === "number" ? maxAge : box ? maxAge(box.value) : 0;

  const isFreshFor = (entry: Entry<K, T>, maxAgeMs = maxAgeOf(entry)) =>
    isFresh(entry, env.now(), Math.max(maxAgeMs, dedupeMs));

  function discard(entry: Entry<K, T>) {
    timer.stop(entry);
    entries.delete(entry.hash);
  }

  const timer = createEntryTimer<K, T>({
    discard,
    env,
    gcMs,
    maxAutoFailures,
    retry: (entry) => startFetch(entry),
  });

  function publish(entry: Entry<K, T>) {
    derive(entry);
    timer.schedule(entry);
    for (const listener of entry.listeners) listener(entry.state);
    for (const observer of observers) observer(entry.key, entry.state);
  }

  function obtain(key: K) {
    const hash = stableKey(key);
    const existing = entries.get(hash);
    if (existing) return existing;
    const entry = createEntry<K, T>(key, hash);
    entries.set(hash, entry);
    timer.schedule(entry);
    return entry;
  }

  function stopFetch(entry: Entry<K, T>) {
    entry.inflight?.controller.abort();
    entry.inflight = undefined;
    entry.idle?.resolve();
    entry.idle = undefined;
  }

  function abandon(entry: Entry<K, T>) {
    const wanted = entry.listeners.size > 0 || entry.waiters > 0;
    if (wanted || !entry.inflight?.consumed || entries.get(entry.hash) !== entry) return;
    stopFetch(entry);
    publish(entry);
  }

  const fetchDeps: FetchDeps<K, T> = {
    cooldown,
    env,
    load: options.load,
    onFailure: (entry, error, permanent) => {
      stopFetch(entry);
      entry.error = { value: error };
      entry.failures++;
      entry.permanent = permanent;
      publish(entry);
    },
    onSuccess: (entry, data) => {
      stopFetch(entry);
      store(entry, { value: entry.box ? share(entry.box.value, data) : data }, env.now());
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
    entry.permanent = false;
    persistence?.schedule();
  }

  function startFetch(entry: Entry<K, T>) {
    entry.inflight?.controller.abort();
    const inflight = { consumed: false, controller: new AbortController() };
    entry.inflight = inflight;
    entry.idle ??= deferred();
    if (!entry.box) entry.error = undefined;
    publish(entry);
    void runFetch(fetchDeps, entry, inflight);
  }

  async function settle(entry: Entry<K, T>): Promise<T> {
    entry.waiters++;
    try {
      while (entry.idle) await entry.idle.promise;
    } finally {
      entry.waiters--;
    }
    if (entry.error) throw entry.error.value;
    if (entry.view) return entry.view.value;
    throw new ResourceCleared();
  }

  function write(entry: Entry<K, T>, value: T, at: number, refetch: boolean) {
    const interrupted = refetch && entry.inflight !== undefined;
    stopFetch(entry);
    store(entry, { value }, at);
    publish(entry);
    if (interrupted) startFetch(entry);
  }

  const amend = (entry: Entry<K, T>, value: T) =>
    write(entry, value, entry.box ? entry.dataAt : env.now(), true);

  function markStale(entry: Entry<K, T>) {
    entry.stale = true;
    if (entry.listeners.size === 0 && !entry.inflight) publish(entry);
    else startFetch(entry);
  }

  function rewrite(entry: Entry<K, T>, change: (current: T) => T) {
    if (entry.box) amend(entry, change(entry.box.value));
    else markStale(entry);
  }

  function reset(entry: Entry<K, T>) {
    stopFetch(entry);
    entry.box = undefined;
    entry.error = undefined;
    entry.failures = 0;
    entry.layers.clear();
    entry.permanent = false;
    entry.stale = false;
    publish(entry);
    if (entry.listeners.size === 0) discard(entry);
  }

  const cache: ResourceCache<K, T> = {
    clear: () => {
      requests.abort();
      for (const entry of [...entries.values()]) reset(entry);
    },
    dispose: () => {
      persistence?.stop();
      requests.abort();
      for (const entry of entries.values()) {
        stopFetch(entry);
        timer.stop(entry);
      }
      entries.clear();
      observers.clear();
    },
    ensure: (key, ensureOptions) => {
      const entry = obtain(key);
      if (entry.view && isFreshFor(entry, ensureOptions?.maxAgeMs))
        return Promise.resolve(entry.view.value);
      if (!entry.inflight) startFetch(entry);
      return settle(entry);
    },
    entries: () =>
      [...entries.values()].map(({ dataAt, key, listeners, state }) => ({
        dataAt,
        key,
        state,
        subscribers: listeners.size,
      })),
    evictInactive: () => {
      if (!Number.isFinite(gcMs)) return;
      for (const entry of [...entries.values()]) if (isInactive(entry)) discard(entry);
    },
    flush: () => persistence?.flush(),
    invalidate: (key) => {
      const entry = entries.get(stableKey(key));
      if (entry) markStale(entry);
    },
    invalidateWhere: (match) => {
      for (const entry of [...entries.values()]) if (match(entry.key)) markStale(entry);
    },
    modify: (key, update) => {
      const entry = entries.get(stableKey(key));
      if (entry) rewrite(entry, update);
    },
    onChange: (listener) => {
      observers.add(listener);
      return () => observers.delete(listener);
    },
    outdated: (key) => {
      const entry = entries.get(stableKey(key));
      return entry !== undefined && maxAgeOf(entry) > 0 && !isFreshFor(entry);
    },
    overlay: (key, apply) => {
      const entry = obtain(key);
      const layer = { apply };
      entry.layers.add(layer);
      publish(entry);
      return {
        commit: () => {
          if (entry.layers.delete(layer)) rewrite(entry, apply);
        },
        discard: () => {
          if (entry.layers.delete(layer)) publish(entry);
        },
      };
    },
    patch: (key, update) => {
      const entry = obtain(key);
      amend(entry, update(entry.box?.value));
    },
    read: (key) => entries.get(stableKey(key))?.view?.value,
    refresh: (key) => {
      const entry = obtain(key);
      startFetch(entry);
      return settle(entry);
    },
    remove: (key) => {
      const entry = entries.get(stableKey(key));
      if (!entry) return;
      reset(entry);
      persistence?.schedule();
    },
    request: requests.run,
    restore: async () => {
      await persistence?.restore();
    },
    set: (key, data) => {
      const entry = obtain(key);
      entry.stale = false;
      write(entry, data, env.now(), false);
    },
    state: (key) => entries.get(stableKey(key))?.state ?? IDLE,
    subscribe: (key, listener, subscribeOptions) => {
      const entry = obtain(key);
      entry.listeners.add(listener);
      timer.schedule(entry);
      const wantsFetch =
        subscribeOptions?.enabled !== false &&
        !(subscribeOptions?.retryFailed === false && entry.error) &&
        !entry.inflight &&
        !isFreshFor(entry, subscribeOptions?.maxAgeMs) &&
        entry.failures < maxAutoFailures &&
        !entry.permanent;
      if (wantsFetch) startFetch(entry);
      return () => {
        entry.listeners.delete(listener);
        timer.schedule(entry);
        if (entry.listeners.size === 0) queueMicrotask(() => abandon(entry));
      };
    },
  };
  return cache;
}
