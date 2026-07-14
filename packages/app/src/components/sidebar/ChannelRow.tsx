import type { Channel } from "@slock/slack-api";
import { ContextMenu, Icon, useContextMenu } from "@slock/ui";
import { createMemo } from "solid-js";
import { store, channelDisplayName } from "../../lib/store";
import ChannelActionsMenuItems from "../channel/ChannelActionsMenuItems";

export default function ChannelRow(props: { channel: Channel; unread: boolean }) {
  const ctxMenu = useContextMenu();
  const isActive = createMemo(() => {
    const v = store.viewState.activeView();
    return store.viewState.nav() === "home" && v?.kind === "channel" && v.id === props.channel.id;
  });
  const muted = createMemo(() => store.preferences.isChannelMuted(props.channel.id));

  return (
    <>
      <button
        class="sidebar-row btn-reset flex-align-center"
        classList={{
          active: isActive(),
          muted: muted(),
          unread: props.unread && !muted(),
        }}
        onClick={() => store.viewState.setActiveView({ id: props.channel.id, kind: "channel" })}
        onContextMenu={ctxMenu.open}
        type="button"
      >
        <span class="sidebar-row-icon">
          {props.channel.private ? <Icon name="lock" size={13} /> : "#"}
        </span>
        <span class="sidebar-row-name truncate">{channelDisplayName(props.channel)}</span>
        {!muted() && props.channel.mentions ? (
          <span class="sidebar-badge">{props.channel.mentions}</span>
        ) : null}
      </button>
      <ContextMenu onClose={ctxMenu.close} open={ctxMenu.isOpen()} x={ctxMenu.x()} y={ctxMenu.y()}>
        <ChannelActionsMenuItems
          channelId={props.channel.id}
          channelTitle={channelDisplayName(props.channel)}
          onClose={ctxMenu.close}
        />
      </ContextMenu>
    </>
  );
}
