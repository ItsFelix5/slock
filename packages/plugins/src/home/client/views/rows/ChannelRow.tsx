import { Slot, service } from "@slock/core/solid";
import { channelDisplayName, channelIconName } from "@slock/plugins/channels/client/api";
import { conversationDragSource } from "@slock/plugins/conversations/client/api/conversationDrag";
import { openConversationInSplit } from "@slock/plugins/conversations/client/api/nav";
import { SplitNavigation } from "@slock/plugins/shell/client/api/SplitNavigation";
import type { Channel } from "@slock/types";
import { ContextMenu, Icon, InlineFeedback, useContextMenu } from "@slock/ui";
import { createMemo } from "solid-js";
import SidebarRowEnd from "./SidebarRowEnd";
import "./SidebarRow.css";

const feedback = service("feedback");

const sidebarStore = service("sidebar");

const conversationsStore = service("conversations");
const prefsStore = service("prefs");

export default function ChannelRow(props: { channel: Channel; unread: boolean }) {
  const ctxMenu = useContextMenu();
  const isActive = createMemo(
    () =>
      sidebarStore.nav() === "home" &&
      conversationsStore.isOpenInAnyPane(props.channel.id, "channel"),
  );
  const muted = createMemo(() => prefsStore.isChannelMuted(props.channel.id));

  return (
    <>
      <div class="sidebar-row-wrap">
        <SplitNavigation onSplit={() => openConversationInSplit(props.channel.id)}>
          <button
            {...conversationDragSource(props.channel.id)}
            class={[
              "sidebar-row sidebar-row-channel btn-reset flex-align-center",
              {
                active: isActive(),
                muted: muted(),
                unread: props.unread && !muted(),
              },
            ]}
            data-channel-id={props.channel.id}
            data-nav-row
            onClick={() =>
              conversationsStore.setActiveView({ id: props.channel.id, kind: "channel" })
            }
            onContextMenu={ctxMenu.open}
            tabindex={-1}
            type="button"
          >
            <span class="sidebar-row-icon">
              <Icon
                name={channelIconName(props.channel.private, props.channel.archived)}
                size={13}
              />
            </span>
            <span class="sidebar-row-name truncate">{channelDisplayName(props.channel)}</span>
            <SidebarRowEnd id={props.channel.id} kind="channel" mentions={props.channel.mentions} />
          </button>
        </SplitNavigation>
        <InlineFeedback class="sidebar-row-feedback" feedback={feedback.get(props.channel.id)} />
      </div>
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
