import { createQuery, skipToken } from "@tanstack/solid-query";
import { queryClient } from "./queryClient";

interface KeyedQuery<T> {
  queryFn: () => Promise<T>;
  queryKey: readonly unknown[];
  staleTime?: number;
}

export function createKeyedQuery<T>(source: () => KeyedQuery<T> | undefined) {
  return createQuery(
    () => {
      const query = source();
      return {
        queryFn: query ? query.queryFn : skipToken,
        queryKey: query?.queryKey ?? [],
        staleTime: query?.staleTime,
      };
    },
    () => queryClient,
  );
}
