import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import type { MembershipEvent } from "@slock/types";
import { gatewayHandler } from "../../realtime/client/api";
import { createDmTitleResolver } from "./dmTitle";
import { createDmsStore } from "./store";

const DM_EVENTS = [
  "im_created",
  "im_close",
  "im_open",
  "mpim_close",
  "mpim_open",
  "mpim_joined",
] as const;

const setup: Setup = (ctx) => {
  const bootstrap = service("bootstrap");
  const users = service("users");
  const view = service("conversations");
  const store = createDmsStore({
    activeView: view.activeView,
    bootstrap: () => bootstrap.bootstrap.data,
    closeUserProfile: users.closeUserProfile,
    currentUser: users.currentUser,
    openInPane: service("shell.panes").openInNewPane,
    setActiveView: view.setActiveView,
  });
  ctx.provide("dms", store);
  ctx.add("shell.title", createDmTitleResolver(store.dmById, users.userById), { order: 0 });
  ctx.add(
    "shell.default",
    () => {
      const [first] = store.directMessages();
      return first && { id: first.id, kind: "dm" };
    },
    { order: 1 },
  );
  ctx.add("conversations.kind", (id) => (store.conversationKind(id) === "dm" ? "dm" : undefined));
  ctx.add("conversations.opened", (opened) => {
    if (opened.kind === "dm" && store.closedDmIds[opened.id])
      store.setClosedDmIds(opened.id, false);
  });
  ctx.add(
    "realtime.handler",
    gatewayHandler(DM_EVENTS, (payload: MembershipEvent) => {
      switch (payload.type) {
        case "im_created": {
          const { channel } = payload;
          const userId = channel.user ?? payload.user;
          if (!userId) return;
          if (!store.dmById(channel.id)) store.ensureDm(channel.id, userId);
          else if (store.closedDmIds[channel.id]) store.setClosedDmIds(channel.id, false);
          return;
        }
        case "im_close":
        case "mpim_close":
          if (payload.channel) store.setClosedDmIds(payload.channel, true);
          return;
        case "im_open":
        case "mpim_open":
          if (payload.channel) store.setClosedDmIds(payload.channel, false);
          return;
        case "mpim_joined":
          if (payload.channel) void store.ensureMpdm(payload.channel);
      }
    }),
  );
};

export default setup;
