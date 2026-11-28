import type { Setup } from "@slock/core";
import { lazyChunk } from "@slock/core/solid";
import { gatewayHandler } from "@slock/plugins/realtime/client/api";
import { ifPresent, parseChannelId } from "@slock/slack";
import { Show } from "solid-js";
import { refreshHeadcount } from "./headcount";
import HeaderMembersButton from "./views/HeaderMembersButton";

const MembersTab = lazyChunk(() => import("./views/MembersTab"));

const setup: Setup = (ctx) => {
  ctx.add("messages.header", HeaderMembersButton, { order: 20 });
  ctx.add(
    "realtime.handler",
    gatewayHandler(["member_joined_channel", "member_left_channel"], (event) => {
      const id = ifPresent(parseChannelId, event.channel);
      if (id) refreshHeadcount(id);
    }),
  );
  ctx.add(
    "channel-details.tab",
    {
      count: (details) => details.memberCount,
      id: "members",
      label: "Members",
      view: (props) => (
        <Show keyed when={props.channelId}>
          {(channelId) => (
            <MembersTab
              channelId={channelId}
              channelName={props.channelName}
              groupChat={props.groupChat}
              memberCount={props.memberCount}
              onMembersChanged={props.refetch}
            />
          )}
        </Show>
      ),
    },
    { order: 10 },
  );
};

export default setup;
