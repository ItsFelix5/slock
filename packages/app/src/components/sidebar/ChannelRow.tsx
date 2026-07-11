import type { Channel } from "@slock/slack-api";
import { ContextMenu, Icon, useContextMenu } from "@slock/ui";
import { createMemo } from "solid-js";
import {
  activeView,
  channelDisplayName,
  isChannelMuted,
  nav,
  setActiveView,
} from "../../lib/store";
import ChannelActionsMenuItems from "../channel/ChannelActionsMenuItems";

export default function ChannelRow(props: { channel: Channel; unread: boolean }) {
  const ctxMenu = useContextMenu();
  const isActive = createMemo(() => {
    const v = activeView();
    return nav() === "home" && v?.kind === "channel" && v.id === props.channel.id;
  });
  const muted = createMemo(() => isChannelMuted(props.channel.id));

  return (
    <>
      <button
        type="button"
        class="sidebar-row"
        classList={{
          active: isActive(),
          unread: props.unread && !muted(),
          muted: muted(),
        }}
        onClick={() => setActiveView({ kind: "channel", id: props.channel.id })}
        onContextMenu={ctxMenu.open}
      >
        <span class="sidebar-row-icon">
          {props.channel.private ? <Icon name="lock" size={13} /> : "#"}
        </span>
        <span class="sidebar-row-name">{channelDisplayName(props.channel)}</span>
        {!muted() && props.channel.mentions ? (
          <span class="sidebar-badge">{props.channel.mentions}</span>
        ) : null}
      </button>
      <ContextMenu open={ctxMenu.isOpen()} x={ctxMenu.x()} y={ctxMenu.y()} onClose={ctxMenu.close}>
        <ChannelActionsMenuItems
          channelId={props.channel.id}
          channelTitle={channelDisplayName(props.channel)}
          onClose={ctxMenu.close}
        />
      </ContextMenu>
    </>
  );
}
