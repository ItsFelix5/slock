import type { Setup } from "@slock/core";
import { createResourceHub } from "@slock/resource";
import { getActiveAccountId, listAccounts } from "@slock/slack";
import { pageIdle } from "@slock/ui";
import { createEffect } from "solid-js";
import { createIdbAdapter, noPersistence, pruneSnapshots } from "./persistStore";
import { toResourceEnv } from "./resourceEnv";
import { installRevalidateTriggers } from "./revalidateTriggers";

const setup: Setup = async (ctx) => {
  const hub = createResourceHub(toResourceEnv(ctx.get("env")));
  const account = getActiveAccountId();
  if (account) void pruneSnapshots(listAccounts().map(({ id }) => id)).catch(() => {});
  ctx.provide("query", { hub, persist: account ? createIdbAdapter(account) : noPersistence });
  createEffect(
    () => pageIdle(),
    (idle) => {
      if (idle) hub.evictInactive();
    },
  );
  const env = ctx.get("env");
  ctx.onCleanup(installRevalidateTriggers({ now: env.now, onRevalidate: hub.revalidate }));
  ctx.onCleanup(() => {
    hub.clear();
    hub.dispose();
  });
  await hub.restore();
};

export default setup;
