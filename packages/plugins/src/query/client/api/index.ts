import { service } from "@slock/core/solid";
import { createQuery, type QueryClient, skipToken } from "@tanstack/solid-query";

export { createReactiveQueryCache, type ReactiveQueryCache } from "./reactiveQueryCache";

declare module "@slock/core/types" {
  interface Services {
    query: { client: QueryClient };
  }
}

interface KeyedQuery<T> {
  queryFn: (context: { signal: AbortSignal }) => Promise<T>;
  queryKey: readonly unknown[];
  staleTime?: number;
}

const query = service("query");

export function createKeyedQuery<T>(source: () => KeyedQuery<T> | undefined) {
  return createQuery(
    () => {
      const keyed = source();
      return {
        queryFn: keyed ? keyed.queryFn : skipToken,
        queryKey: keyed?.queryKey ?? [],
        staleTime: keyed?.staleTime,
      };
    },
    () => query.client,
  );
}

export function defineKey<Args extends unknown[]>(name: string) {
  return (...args: Args) => [name, ...args] as const;
}
