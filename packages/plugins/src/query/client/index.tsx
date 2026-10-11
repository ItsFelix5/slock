import type { Setup } from "@slock/core";
import { ApiError } from "@slock/slack";
import { pageIdle } from "@slock/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createEffect } from "solid-js";

const MAX_BACKOFF_DELAY_MS = 30_000;
const GC_MS = 120_000;

const setup: Setup = (ctx) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: GC_MS,
        staleTime: Number.POSITIVE_INFINITY,
        retryDelay: (attemptIndex, error) =>
          error instanceof ApiError && error.retryAfterMs !== undefined
            ? error.retryAfterMs
            : Math.min(1000 * 2 ** attemptIndex, MAX_BACKOFF_DELAY_MS),
      },
    },
  });
  ctx.provide("query", { client });
  ctx.add("shell.provider", (props) => (
    <QueryClientProvider client={client}>{props.children}</QueryClientProvider>
  ));
  createEffect(() => {
    if (pageIdle()) client.removeQueries({ type: "inactive" });
  });
  ctx.onCleanup(() => client.clear());
};

export default setup;
