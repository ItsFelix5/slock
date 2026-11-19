import { getActiveAccountId, listAccounts } from "@slock/slack";
import { dehydrate, hydrate, type QueryClient } from "@tanstack/solid-query";
import { defineKey } from "./api";
import { pruneSnapshots, readSnapshot, writeSnapshot } from "./persistStore";

const PERSISTED_KEYS = [defineKey<[]>("bootstrap")(), defineKey<[]>("userPrefs")()];
const WRITE_DELAY_MS = 1000;

const isPersisted = (key: readonly unknown[]) => PERSISTED_KEYS.some(([name]) => name === key[0]);

export async function restoreQueries(client: QueryClient): Promise<void> {
  const account = getActiveAccountId();
  if (!account) return;
  void pruneSnapshots(listAccounts().map(({ id }) => id)).catch(() => {});
  try {
    const snapshot = await readSnapshot(account);
    if (!snapshot) return;
    hydrate(client, snapshot);
    for (const queryKey of PERSISTED_KEYS)
      await client.invalidateQueries({ queryKey, refetchType: "none" });
  } catch {}
}

export function persistQueries(client: QueryClient): () => void {
  const account = getActiveAccountId();
  if (!account) return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    const snapshot = dehydrate(client, {
      shouldDehydrateQuery: (query) =>
        query.state.status === "success" && isPersisted(query.queryKey),
    });
    void writeSnapshot(account, snapshot).catch(() => {});
  };
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success") return;
    if (!isPersisted(event.query.queryKey)) return;
    timer ??= setTimeout(flush, WRITE_DELAY_MS);
  });
  return () => {
    unsubscribe();
    clearTimeout(timer);
  };
}
