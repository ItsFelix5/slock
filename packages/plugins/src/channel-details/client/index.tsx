import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { MenuItem } from "@slock/ui";
import { Show } from "solid-js";
import { openConversationInSplit } from "../../conversations/client/api/nav";
import type { ChannelMenuProps } from "../../messages/client/api";
import { SplitNavigation } from "../../shell/client/api/SplitNavigation";
import { createChannelDetailsStore } from "./channelDetails";
import ChannelDetails from "./views/ChannelDetails";
import ChannelHoverCard from "./views/ChannelHoverCard";
import ChannelMentionCard from "./views/ChannelMentionCard";

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
