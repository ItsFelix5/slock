import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { SLACK_USER_ID } from "@slock/slack";
import { createEffect } from "solid-js";
import { gatewayHandler } from "../../realtime/client/api";
import { fetchUserPresence } from "../../slack/client/api";
import { reportActivityWhileAway } from "./activity";

const setup: Setup = (ctx) => {
  const users = service("users");
  const dms = service("dms");
  const realtime = service("realtime");
  reportActivityWhileAway(ctx, users);

  function watchedIds(): string[] {
    const ids = new Set<string>();
    for (const dm of dms.allDirectMessages()) {
      if (dm.userId) ids.add(dm.userId);
      for (const id of dm.memberIds ?? []) ids.add(id);
    }
    const selfId = users.currentUser()?.id;
    if (selfId) ids.add(selfId);
    ids.delete(SLACK_USER_ID);
    return [...ids];
  }

  const hydrated = new Set<string>();
  function hydrate(ids: string[]) {
    for (const id of ids) {
      if (hydrated.has(id)) continue;
      hydrated.add(id);
      fetchUserPresence(id)
        .then((presence) => presence && users.setPresenceOverrides(id, presence))
        .catch(() => hydrated.delete(id));
    }
  }

  createEffect(() => {
    const ids = watchedIds();
    if (realtime.gatewayConnected()) realtime.send({ ids, type: "watch_presence" });
    hydrate(ids);
  });
  ctx.add("realtime.open", () => realtime.send({ ids: watchedIds(), type: "watch_presence" }));
  ctx.add(
    "realtime.handler",
    gatewayHandler(["presence_change"], (event) => {
      const presence = event.presence === "away" ? "away" : "active";
      const ids = event.users ?? (event.user ? [event.user] : []);
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
