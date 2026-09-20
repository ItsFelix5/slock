import { createStore, produce, type SetStoreFunction } from "solid-js/store";
import { backgroundFetchQueue } from "./concurrencyQueue";

export interface KeyedAsyncCache<T> {
  entry(key: string): T | undefined;
  ensure(key: string): Promise<T | undefined>;
  has(key: string): boolean;
  hasError(key: string): boolean;
  invalidate(key: string): void;
  isKnown(key: string): boolean;
  isLoading(key: string): boolean;
  refresh(key: string): Promise<T | undefined>;
  set(key: string, value: T): void;
  setStore: SetStoreFunction<Record<string, T>>;
  store: Record<string, T>;
  update(key: string, updater: (value: T | undefined) => T): void;
}

export function createKeyedAsyncCache<T>(
  fetcher: (key: string) => Promise<T>,
  options: { onError?: (err: unknown, key: string) => void } = {},
): KeyedAsyncCache<T> {
  const [store, setStore] = createStore<Record<string, T>>({});
  const [loading, setLoading] = createStore<Record<string, boolean>>({});
  const [errors, setErrors] = createStore<Record<string, boolean>>({});
  const inFlight = new Map<string, Promise<T | undefined>>();

  function entry(key: string): T | undefined {
    return store[key];
  }

  function has(key: string): boolean {
    return key in store;
  }

  function isLoading(key: string): boolean {
    return !!loading[key];
  }

  function isKnown(key: string): boolean {
    return has(key) || isLoading(key);
  }

  function hasError(key: string): boolean {
    return !!errors[key];
  }

  function set(key: string, value: T): void {
    setStore(key, value);
  }

  function update(key: string, updater: (value: T | undefined) => T): void {
    setStore(key, updater(store[key]));
  }

  function invalidate(key: string): void {
    setStore(produce((s) => delete s[key]));
    setErrors(key, false);
  }

  function load(key: string): Promise<T | undefined> {
    const existing = inFlight.get(key);
    if (existing) return existing;
    setLoading(key, true);
    setErrors(key, false);
    const request = backgroundFetchQueue
      .run(() => fetcher(key))
      .then((value) => {
        setStore(key, value);
        return value;
      })
      .catch<T | undefined>((err) => {
        setErrors(key, true);
        options.onError?.(err, key);
      })
      .finally(() => {
        setLoading(key, false);
        inFlight.delete(key);
      });
    inFlight.set(key, request);
    return request;
  }

  function ensure(key: string): Promise<T | undefined> {
    return has(key) ? Promise.resolve(store[key]) : load(key);
  }

  function refresh(key: string): Promise<T | undefined> {
    return load(key);
  }

  return {
    ensure,
    entry,
    has,
    hasError,
    invalidate,
    isKnown,
    isLoading,
    refresh,
    set,
    setStore,
    store,
    update,
  };
}
