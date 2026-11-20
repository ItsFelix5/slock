import { isRecord } from "@slock/core";
import type { Bootstrap, UserPrefs } from "@slock/types";
import { defineQuery } from "../../query/client/api";
import { fetchBootstrap, fetchUserPrefs } from "../../slack/client/api";

const isNull = (value: unknown): value is null => value === null;

const bootstrapQuery = defineQuery<null, Bootstrap>({
  load: () => fetchBootstrap(() => bootstrapQuery.invalidate(null)),
  name: "bootstrap",
  persist: { isArg: isNull, isData: (value): value is Bootstrap => isRecord(value), version: 1 },
});

const userPrefsQuery = defineQuery<null, UserPrefs>({
  load: fetchUserPrefs,
  name: "userPrefs",
  persist: { isArg: isNull, isData: (value): value is UserPrefs => isRecord(value), version: 1 },
});

export function createBootstrapStore(deps: { retryHooks: () => (() => void)[] }) {
  const bootstrap = bootstrapQuery.state(() => null);
  const userPrefs = userPrefsQuery.state(() => null);

  const mutateUserPrefs = (updater: (current: UserPrefs | undefined) => UserPrefs | undefined) => {
    const next = updater(userPrefsQuery.read(null));
    if (next) userPrefsQuery.set(null, next);
  };

  async function retryUserPrefs(): Promise<void> {
    await userPrefsQuery.refresh(null).catch(() => {});
  }

  async function retryBootstrap(): Promise<void> {
    await bootstrapQuery.refresh(null).catch(() => {});
    if (userPrefs().error) void retryUserPrefs();
    for (const hook of deps.retryHooks()) hook();
  }

  return { bootstrap, mutateUserPrefs, retryBootstrap, retryUserPrefs, userPrefs };
}
