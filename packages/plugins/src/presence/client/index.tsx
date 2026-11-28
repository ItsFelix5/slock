import { type Setup, sameItems } from "@slock/core";
import { service } from "@slock/core/solid";
import { gatewayHandler } from "@slock/plugins/realtime/client/api";
import { isUserId } from "@slock/slack";
import { createEffect, createMemo } from "solid-js";
import { watchedUserIds } from "./watchedIds";
import { whenIdle } from "./whenIdle";

const setup: Setup = (ctx) => {
  const env = ctx.get("env");
  const users = service("users");
  const dms = service("dms");
  const realtime = service("realtime");

  const watchedIds = createMemo(
    () => watchedUserIds(dms.allDirectMessages(), users.currentUserId()),
    {
      equals: sameItems,
    },
  );

  createEffect(
    () => ({ connected: realtime.gatewayConnected(), ids: watchedIds() }),
    ({ connected, ids }) => {
      if (connected) realtime.send({ ids, type: "watch_presence" });
      return whenIdle(env, () => {
        for (const id of ids) users.loadPresence(id);
      });
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
      const selfId = users.currentUserId();
      if (selfId) users.setPresenceOverrides(selfId, event.presence === "away" ? "away" : "active");
    }),
  );
};

export default setup;
