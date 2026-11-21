import type { Setup } from "@slock/core";
import { captureDeleted } from "./capture";
import { serveKeptAssets } from "./keptAssets";
import { restoreDeleted } from "./restore";
import { createLogStore } from "./store";

const PURGE_INTERVAL_MS = 60 * 60 * 1000;

const setup: Setup = (ctx) => {
  const env = ctx.get("env");
  const store = createLogStore(`${ctx.get("instance").dataDir(ctx.id)}/log.sqlite`, env);
  store.purge();
  const purgeTimer = env.setInterval(store.purge, PURGE_INTERVAL_MS);
  ctx.onCleanup(() => {
    env.clearInterval(purgeTimer);
    store.close();
  });
  ctx.add("realtime.event", captureDeleted(store));
  ctx.add("http", restoreDeleted(store), { order: 10 });
  ctx.add("http", serveKeptAssets(store), { order: 10 });
};

export default setup;
