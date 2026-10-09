import type { QueryClient, QueryFunction, skipToken } from "@tanstack/solid-query";
import { createSignal, type Signal } from "solid-js";

export interface ReactiveQueryCache<T> {
  entry(key: string): T | undefined;
  ensure(key: string): void;
  hasError(key: string): boolean;
  invalidate(key: string): void;
  isLoading(key: string): boolean;
  set(key: string, value: T): void;
}

export function createReactiveQueryCache<T>(
  queryClient: QueryClient,
  keyPrefix: string,
  toOptions: (key: string) => {
    queryKey: string[];
    queryFn?: typeof skipToken | QueryFunction<T, string[]>;
  },
): ReactiveQueryCache<T> {
  const versions = new Map<string, Signal<number>>();
  const loggedFailures = new Set<string>();
  const versionFor = (key: string) => {
    const hash = JSON.stringify(toOptions(key).queryKey);
    let signal = versions.get(hash);
    if (!signal) {
      signal = createSignal(0);
      versions.set(hash, signal);
    }
    return signal;
  };
  queryClient.getQueryCache().subscribe((event) => {
    if (event.query.queryKey[0] !== keyPrefix) return;
    versions.get(JSON.stringify(event.query.queryKey))?.[1]((v) => v + 1);
  });

  function ensure(key: string): void {
    const state = queryClient.getQueryState(toOptions(key).queryKey);
    if (state?.fetchStatus === "fetching") return;
    if ((state?.errorUpdateCount ?? 0) >= 3) {
      if (!loggedFailures.has(key)) {
        loggedFailures.add(key);
        console.error(`[${keyPrefix}] gave up after 3 failed attempts for "${key}"`, state?.error);
      }
      return;
    }
    loggedFailures.delete(key);
    void queryClient.ensureQueryData(toOptions(key)).catch(() => {});
  }

  function entry(key: string): T | undefined {
    versionFor(key)[0]();
    ensure(key);
    return queryClient.getQueryData<T>(toOptions(key).queryKey);
  }

  function isLoading(key: string): boolean {
    versionFor(key)[0]();
    return queryClient.getQueryState(toOptions(key).queryKey)?.fetchStatus === "fetching";
  }

  function hasError(key: string): boolean {
    versionFor(key)[0]();
    return queryClient.getQueryState(toOptions(key).queryKey)?.status === "error";
  }

  function invalidate(key: string): void {
    void queryClient.invalidateQueries({ queryKey: toOptions(key).queryKey });
  }

  function set(key: string, value: T): void {
    queryClient.setQueryData<T>(toOptions(key).queryKey, value);
  }

  return { entry, ensure, hasError, invalidate, isLoading, set };
}
