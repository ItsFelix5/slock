import { ContextMenu, Icon, Tooltip, useContextMenu } from "@slock/ui";
import { createMemo } from "solid-js";
import type { Channel } from "../../../lib/api";
import { channelDisplayName, channelIconName } from "../../../lib/displayName";
import { openConversationInSplit } from "../../../lib/navigation/conversationNav";
import { store } from "../../../lib/store";
import ChannelActionsMenuItems from "../../channel/ChannelActionsMenuItems";
import { channelHasDraft } from "../../composer/lib/drafts";
import { SplitNavigation } from "../../navigation/SplitNavigation";
import { unreadSummary } from "../lib/unreadSummary";

export default function ChannelRow(props: { channel: Channel; unread: boolean }) {
  const ctxMenu = useContextMenu();
  const isActive = createMemo(
    () =>
      store.viewState.nav() === "home" && store.panes.isOpenInAnyPane(props.channel.id, "channel"),
  );
  const muted = createMemo(() => store.preferences.isChannelMuted(props.channel.id));
  const hasDraft = createMemo(() => channelHasDraft(props.channel.id));
  const unreadTooltip = createMemo(() =>
    unreadSummary({
      currentUserId: store.users.currentUser()?.id,
      lastRead: store.unread.lastReadFor(props.channel.id),
      loadedMessages: store.messages.messagesInChannel(props.channel.id),
      mentions: props.channel.mentions,
    }),
  );

  return (
    <>
      <SplitNavigation onSplit={() => openConversationInSplit(props.channel.id)}>
        <button
          class="sidebar-row sidebar-row-channel btn-reset flex-align-center"
          classList={{
            active: isActive(),
            muted: muted(),
            unread: props.unread && !muted(),
          }}
          data-channel-id={props.channel.id}
          data-nav-row
          onClick={(e) =>
            store.viewState.setActiveView(
              { id: props.channel.id, kind: "channel" },
              { autofocus: e.isTrusted },
            )
          }
          onContextMenu={ctxMenu.open}
          tabIndex={-1}
          type="button"
        >
          <span class="sidebar-row-icon">
            <Icon name={channelIconName(props.channel.private)} size={13} />
          </span>
          <span class="sidebar-row-name truncate">{channelDisplayName(props.channel)}</span>
          <span class="sidebar-row-end">
            {hasDraft() ? (
              <Tooltip content="Draft">
                <span class="sidebar-row-draft">
                  <Icon name="edit" size={12} />
                </span>
              </Tooltip>
            ) : null}
            {!muted() && props.channel.mentions ? (
              <Tooltip content={unreadTooltip()}>
                <span class="sidebar-badge">{props.channel.mentions}</span>
              </Tooltip>
            ) : null}
          </span>
        </button>
      </SplitNavigation>
      <ContextMenu onClose={ctxMenu.close} open={ctxMenu.isOpen()} x={ctxMenu.x()} y={ctxMenu.y()}>
        <ChannelActionsMenuItems
          channelId={props.channel.id}
          channelTitle={channelDisplayName(props.channel)}
          onClose={ctxMenu.close}
          showMoveTo
        />
      </ContextMenu>
    </>
  );
}
