import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { gatewayHandler } from "../../realtime/client/api";
import { createUsersStore } from "./store";

const setup: Setup = (ctx) => {
  const bootstrap = service("bootstrap");
  const store = createUsersStore({
    currentUserBase: () => bootstrap.bootstrap.data?.currentUser,
    isSelfOnline: service("realtime").isSelfOnline,
    panes: service("shell.panes"),
  });
  ctx.provide("users", store);
  ctx.add("conversations.opened", () => store.closeUserProfile());
  ctx.add(
    "realtime.handler",
    gatewayHandler(["user_invalidated"], (event) => {
      const ids = event.users ?? (event.user ? [event.user] : []);
      for (const id of ids) store.invalidateUser(id);
    }),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["user_change"], (event) => store.invalidateUser(event.user.id)),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["bot_added", "bot_changed"], (event) => {
      if (event.bot.id) store.invalidateUser(event.bot.id);
    }),
  );
};

export default setup;
