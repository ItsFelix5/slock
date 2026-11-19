import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { ifPresent, parseChannelId } from "@slock/slack";
import { MenuItem } from "@slock/ui";
import { lazy, Show } from "solid-js";
import { openConversationInSplit } from "../../conversations/client/api/nav";
import type { ChannelMenuProps } from "../../messages/client/api";
import { gatewayHandler } from "../../realtime/client/api";
import { SplitNavigation } from "../../shell/client/api/SplitNavigation";
import { createChannelDetailsStore } from "./channelDetails";
import ChannelHoverCard from "./views/ChannelHoverCard";
import ChannelMentionCard from "./views/ChannelMentionCard";

const ChannelDetails = lazy(() => import("./views/ChannelDetails"));
const TOPIC_OR_PURPOSE = /^(channel|group)_(topic|purpose)$/;
const channelDetails = service("channel-details");

function OpenDetailsItem(props: ChannelMenuProps) {
  return (
    <Show when={!props.isDm}>
      <MenuItem
        icon="channel-section"
        onClick={() => {
          props.close();
          channelDetails.openChannelDetails(props.channelId);
        }}
      >
        Open channel details
      </MenuItem>
    </Show>
  );
}

const setup: Setup = (ctx) => {
  ctx.provide("channel-details", createChannelDetailsStore());
  ctx.add("messages.channelMenu", OpenDetailsItem, { order: 10 });
  ctx.add(
    "realtime.handler",
    gatewayHandler(["channel_updated"], (event) => {
      for (const id of event.channels)
        channelDetails.invalidateChannelDetails(parseChannelId(id), event.updates.postingChanged);
    }),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["member_joined_channel", "member_left_channel"], (event) => {
      const id = ifPresent(parseChannelId, event.channel);
      if (id) channelDetails.invalidateChannelDetails(id);
    }),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["message"], (event) => {
      if (!TOPIC_OR_PURPOSE.test(event.subtype ?? "")) return;
      const id = ifPresent(parseChannelId, event.channel);
      if (id) channelDetails.invalidateChannelDetails(id);
    }),
  );
  ctx.add("shell.overlay", ChannelDetails);
  ctx.add("composer.mentionCard", ChannelMentionCard);
  ctx.add("messages.titleOpen", (view) => {
    if (view.kind === "channel") channelDetails.openChannelDetails(view.id);
  });
  ctx.add("messages.blockKit", {
    wrapChannelMention: (id, trigger) => (
      <SplitNavigation onSplit={() => openConversationInSplit(id)}>
        <ChannelHoverCard channelId={id}>{trigger}</ChannelHoverCard>
      </SplitNavigation>
    ),
  });
};

export default setup;
