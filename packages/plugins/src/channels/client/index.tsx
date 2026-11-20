import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { ifPresent, parseChannelId } from "@slock/slack";
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
    bootstrap: () => bootstrap.bootstrap().data,
    decorators: ctx.use("channels.decorate"),
    mutateUserPrefs: bootstrap.mutateUserPrefs,
    setActiveView: view.setActiveView,
    userPrefs: () => bootstrap.userPrefs().data,
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
    gatewayHandler(["channel_changed"], (event) => {
      const id = ifPresent(parseChannelId, event.channel);
      if (id) store.invalidateChannelRoster(id);
    }),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["channel_updated"], (event) => {
      for (const id of event.channels)
        store.patchChannel(parseChannelId(id), {
          archived: event.updates.archived,
          topic: event.updates.topic,
        });
    }),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["message"], (event) => {
      const isTopic = event.subtype === "channel_topic" || event.subtype === "group_topic";
      if (!isTopic || event.topic === undefined) return;
      const id = ifPresent(parseChannelId, event.channel);
      if (id) store.patchChannel(id, { topic: event.topic });
    }),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(
      [
        "channel_section_upserted",
        "channel_section_deleted",
        "channel_section_reset",
        "channel_sections_channels_upserted",
        "channel_sections_channels_removed",
      ],
      () => {
        if (!store.sectionStructurePending()) void store.retrySections();
      },
    ),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["star_added", "star_removed"], (event) => {
      const id = ifPresent(parseChannelId, event.item.channel);
      if (event.item.type === "channel" && id)
        store.setStarredChannelIds(id, event.type === "star_added");
    }),
  );
  ctx.add("messages.channelMenu", LeaveItem, { order: 60 });
};

export default setup;
