import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { gatewayHandler } from "../../realtime/client/api";
import { channelDisplayName } from "./api";
import { createMembershipHandler, MEMBERSHIP_EVENTS } from "./membershipEvents";
import { createChannelsStore } from "./store";
import LeaveItem from "./views/LeaveItem";

const setup: Setup = (ctx) => {
  const bootstrap = service("bootstrap");
  const view = service("conversations");
  const store = createChannelsStore({
    activeView: view.activeView,
    bootstrap: () => bootstrap.bootstrap.data,
    decorators: ctx.use("channels.decorate"),
    mutateUserPrefs: bootstrap.mutateUserPrefs,
    setActiveView: view.setActiveView,
    userPrefs: () => bootstrap.userPrefs.data,
  });
  ctx.provide("channels", store);
  ctx.add(
    "shell.title",
    (id) => {
      const channel = store.channelById(id);
      return { name: channelDisplayName(channel, id), prefix: channel?.canvasFileId ? "" : "#" };
    },
    { order: 1 },
  );
  ctx.add(
    "shell.default",
    () => {
      const [first] = store.channels();
      return first && { id: first.id, kind: "channel" };
    },
    { order: 0 },
  );
  ctx.add("bootstrap.retry", () => {
    if (store.sectionsError()) void store.retrySections();
  });
  ctx.add(
    "realtime.handler",
    gatewayHandler(MEMBERSHIP_EVENTS, createMembershipHandler(store, service("users").currentUser)),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["star_added", "star_removed"], (event) => {
      if (event.item.type === "channel" && event.item.channel)
        store.setStarredChannelIds(event.item.channel, event.type === "star_added");
    }),
  );
  ctx.add("messages.channelMenu", LeaveItem, { order: 60 });
};

export default setup;
