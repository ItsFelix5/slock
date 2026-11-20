import { createStore } from "solid-js";
import { backgroundFetchQueue } from "./concurrencyQueue";

export type KeyedCacheSetter<T> = ReturnType<typeof createStore<Record<string, T>>>[1];

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
  setStore: KeyedCacheSetter<T>;
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
    setStore((draft) => {
      draft[key] = value;
    });
  }

  function update(key: string, updater: (value: T | undefined) => T): void {
    setStore((draft) => {
      draft[key] = updater(draft[key]);
    });
  }

  function invalidate(key: string): void {
    inFlight.delete(key);
    setStore((draft) => {
      delete draft[key];
    });
    setErrors((draft) => {
      delete draft[key];
    });
    setLoading((draft) => {
      delete draft[key];
    });
  }

  function load(key: string): Promise<T | undefined> {
    const existing = inFlight.get(key);
    if (existing) return existing;
    setLoading((draft) => {
      draft[key] = true;
    });
    setErrors((draft) => {
      delete draft[key];
    });
    const isCurrent = () => inFlight.get(key) === request;
    const request: Promise<T | undefined> = backgroundFetchQueue
      .run(() => fetcher(key))
      .then((value) => {
        if (isCurrent()) set(key, value);
        return value;
      })
      .catch<T | undefined>((err) => {
        if (!isCurrent()) return;
        setErrors((draft) => {
          draft[key] = true;
        });
        options.onError?.(err, key);
      })
      .finally(() => {
        if (!isCurrent()) return;
        inFlight.delete(key);
        setLoading((draft) => {
          delete draft[key];
        });
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
