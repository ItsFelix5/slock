import { type Setup, sameItems } from "@slock/core";
import { service } from "@slock/core/solid";
import { gatewayHandler } from "@slock/plugins/realtime/client/api";
import { fetchUserPresence } from "@slock/plugins/slack/client/api";
import { isUserId } from "@slock/slack";
import { createEffect, createMemo } from "solid-js";
import { createHydrationQueue } from "./hydrationQueue";
import { watchedUserIds } from "./watchedIds";

const setup: Setup = (ctx) => {
  const env = ctx.get("env");
  const users = service("users");
  const dms = service("dms");
  const realtime = service("realtime");

  const watchedIds = createMemo(
    () => watchedUserIds(dms.allDirectMessages(), users.currentUser()?.id),
    {
      equals: sameItems,
    },
  );

  const hydration = createHydrationQueue({
    load: (id) =>
      fetchUserPresence(id).then(
        (presence) => presence && users.setPresenceOverrides(id, presence),
      ),
    schedule: (run) => {
      if ("requestIdleCallback" in window) {
        const handle = window.requestIdleCallback(run, { timeout: 3000 });
        return () => window.cancelIdleCallback(handle);
      }
      const timer = env.setTimeout(run, 1000);
      return () => env.clearTimeout(timer);
    },
  });
  ctx.onCleanup(hydration.dispose);

  createEffect(
    () => ({ connected: realtime.gatewayConnected(), ids: watchedIds() }),
    ({ connected, ids }) => {
      if (connected) realtime.send({ ids, type: "watch_presence" });
      hydration.request(ids);
    },
  );
  const tickle = () => realtime.send({ type: "tickle" });
  window.addEventListener("focus", tickle);
  ctx.onCleanup(() => window.removeEventListener("focus", tickle));
  ctx.add("realtime.open", () => realtime.send({ ids: watchedIds(), type: "watch_presence" }));
  ctx.add(
    "realtime.handler",
    gatewayHandler(["presence_change"], (event) => {
      const presence = event.presence === "away" ? "away" : "active";
      const ids = (event.users ?? (event.user ? [event.user] : [])).filter(isUserId);
      for (const id of ids) users.setPresenceOverrides(id, presence);
    }),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["manual_presence_change"], (event) => {
      const selfId = users.currentUser()?.id;
      if (selfId) users.setPresenceOverrides(selfId, event.presence === "away" ? "away" : "active");
    }),
  );
};

export default setup;
