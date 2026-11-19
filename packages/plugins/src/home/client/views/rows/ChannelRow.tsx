import { Slot, service } from "@slock/core/solid";
import type { Channel } from "@slock/types";
import { ContextMenu, Icon, useContextMenu } from "@slock/ui";
import { createMemo } from "solid-js";
import { channelDisplayName, channelIconName } from "../../../../channels/client/api";
import { openConversationInSplit } from "../../../../conversations/client/api/nav";
import { SplitNavigation } from "../../../../shell/client/api/SplitNavigation";
import { useRowPrefetch } from "./rowPrefetch";
import SidebarRowEnd from "./SidebarRowEnd";
import "./SidebarRow.css";

const sidebarStore = service("sidebar");

const viewStore = service("conversations");
const conversationsStore = service("conversations");
const prefsStore = service("prefs");

export default function ChannelRow(props: { channel: Channel; unread: boolean }) {
  const ctxMenu = useContextMenu();
  const prefetch = useRowPrefetch(() => props.channel.id);
  const isActive = createMemo(
    () =>
      sidebarStore.nav() === "home" &&
      conversationsStore.isOpenInAnyPane(props.channel.id, "channel"),
  );
  const muted = createMemo(() => prefsStore.isChannelMuted(props.channel.id));

  return (
    <>
      <SplitNavigation onSplit={() => openConversationInSplit(props.channel.id)}>
        <button
          class={["sidebar-row sidebar-row-channel btn-reset flex-align-center", {
            active: isActive(),
            muted: muted(),
            unread: props.unread && !muted(),
          }]} 
          data-channel-id={props.channel.id}
          data-nav-row
          onClick={() => viewStore.setActiveView({ id: props.channel.id, kind: "channel" })}
          {...prefetch}
          onContextMenu={ctxMenu.open}
          tabIndex={-1}
          type="button"
        >
          <span class="sidebar-row-icon">
            <Icon name={channelIconName(props.channel.private, props.channel.archived)} size={13} />
          </span>
          <span class="sidebar-row-name truncate">{channelDisplayName(props.channel)}</span>
          <SidebarRowEnd id={props.channel.id} kind="channel" mentions={props.channel.mentions} />
        </button>
      </SplitNavigation>
      <ContextMenu onClose={ctxMenu.close} open={ctxMenu.isOpen()} x={ctxMenu.x()} y={ctxMenu.y()}>
        <Slot
          channelId={props.channel.id}
          channelTitle={channelDisplayName(props.channel)}
          close={ctxMenu.close}
          isDm={false}
          point="messages.channelMenu"
          showMoveTo
        />
      </ContextMenu>
    </>
  );
}
