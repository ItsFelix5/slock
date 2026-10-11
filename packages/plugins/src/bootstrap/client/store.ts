import type { UserPrefs } from "@slock/types";
import type { QueryClient } from "@tanstack/solid-query";
import { createQuery } from "@tanstack/solid-query";
import { defineKey } from "../../query/client/api";
import { fetchBootstrap, fetchUserPrefs } from "../../slack/client/api";

const bootstrapKey = defineKey<[]>("bootstrap");
const userPrefsKey = defineKey<[]>("userPrefs");

export function createBootstrapStore(deps: {
  client: QueryClient;
  retryHooks: () => (() => void)[];
}) {
  const bootstrap = createQuery(
    () => ({ queryFn: fetchBootstrap, queryKey: bootstrapKey() }),
    () => deps.client,
  );
  const userPrefs = createQuery(
    () => ({ queryFn: fetchUserPrefs, queryKey: userPrefsKey() }),
    () => deps.client,
  );
  const mutateUserPrefs = (updater: (current: UserPrefs | undefined) => UserPrefs | undefined) =>
    deps.client.setQueryData(userPrefsKey(), updater);

  async function retryUserPrefs(): Promise<void> {
    try {
      await userPrefs.refetch();
    } catch {}
  }

  async function retryBootstrap(): Promise<void> {
    try {
      await bootstrap.refetch();
    } catch {
      return;
    }
    if (userPrefs.error) void retryUserPrefs();
    for (const hook of deps.retryHooks()) hook();
  }

  return { bootstrap, mutateUserPrefs, retryBootstrap, retryUserPrefs, userPrefs };
}
