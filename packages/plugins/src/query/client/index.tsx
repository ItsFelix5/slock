import type { Setup } from "@slock/core";
import { pageIdle } from "@slock/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createEffect } from "solid-js";
import { createRetryPolicy } from "./retryPolicy";

const GC_MS = 120_000;

const setup: Setup = (ctx) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: GC_MS,
        staleTime: Number.POSITIVE_INFINITY,
        ...createRetryPolicy(),
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
