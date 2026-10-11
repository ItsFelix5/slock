import type { Setup } from "@slock/core";
import { Show } from "solid-js";
import type { ChannelMenuProps, MessageHeaderProps } from "../../messages/client/api";
import ChannelMoveMenu from "./views/ChannelMoveMenu";

function MoveToItem(props: ChannelMenuProps) {
  return (
    <Show when={!props.isDm && props.showMoveTo}>
      <ChannelMoveMenu channelId={props.channelId} onComplete={props.close} variant="menu-item" />
    </Show>
  );
}

function MoveToHeader(props: MessageHeaderProps) {
  return (
    <Show when={props.kind === "channel"}>
      <ChannelMoveMenu channelId={props.id} />
    </Show>
  );
}

const setup: Setup = (ctx) => {
  ctx.add("messages.channelMenu", MoveToItem, { order: 20 });
  ctx.add("messages.headerLead", MoveToHeader);
};

export default setup;
