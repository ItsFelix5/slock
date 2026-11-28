import type { Setup } from "@slock/core";
import { lazyChunk, service } from "@slock/core/solid";
import { openConversationInSplit } from "@slock/plugins/conversations/client/api/nav";
import type { ChannelMenuProps } from "@slock/plugins/messages/client/api";
import { gatewayHandler } from "@slock/plugins/realtime/client/api";
import { SplitNavigation } from "@slock/plugins/shell/client/api/SplitNavigation";
import { invalidateConversationView } from "@slock/plugins/slack/client/api";
import { ifPresent, isChannelId, parseChannelId } from "@slock/slack";
import { MenuItem } from "@slock/ui";
import { Show } from "solid-js";
import { createChannelDetailsStore } from "./channelDetails";
import ChannelHoverCard from "./views/ChannelHoverCard";
import ChannelMentionCard from "./views/ChannelMentionCard";

const ChannelDetails = lazyChunk(() => import("./views/ChannelDetails"));
const TOPIC_OR_PURPOSE = /^(channel|group)_(topic|purpose)$/;
const channelDetails = service("channel-details");
const dms = service("dms");

function OpenDetailsItem(props: ChannelMenuProps) {
  const groupChat = () => dms.isGroupDm(props.channelId);
  return (
    <Show when={!props.isDm || groupChat()}>
      <MenuItem
        icon="channel-section"
        onClick={() => {
          props.close();
          channelDetails.openChannelDetails(props.channelId);
        }}
      >
        {groupChat() ? "Open group chat details" : "Open channel details"}
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
      for (const id of event.channels) invalidateConversationView(parseChannelId(id));
    }),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["member_joined_channel", "member_left_channel"], (event) => {
      const id = ifPresent(parseChannelId, event.channel);
      if (id) invalidateConversationView(id);
    }),
  );
  ctx.add(
    "realtime.handler",
    gatewayHandler(["message"], (event) => {
      if (!TOPIC_OR_PURPOSE.test(event.subtype ?? "")) return;
      const id = ifPresent(parseChannelId, event.channel);
      if (id) invalidateConversationView(id);
    }),
  );
  ctx.add("shell.overlay", ChannelDetails);
  ctx.add("composer.mentionCard", ChannelMentionCard);
  ctx.add("messages.titleOpen", (view) => {
    if (view.kind === "channel" || dms.isGroupDm(view.id))
      channelDetails.openChannelDetails(view.id);
  });
  ctx.add("messages.blockKit", {
    wrapChannelMention: (id, trigger) =>
      isChannelId(id) ? (
        <SplitNavigation onSplit={() => openConversationInSplit(id)}>
          <ChannelHoverCard channelId={id}>{trigger}</ChannelHoverCard>
        </SplitNavigation>
      ) : (
        trigger
      ),
  });
};

export default setup;
