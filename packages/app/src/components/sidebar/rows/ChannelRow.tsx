import { ContextMenu, Icon, Tooltip, useContextMenu } from "@slock/ui";
import { createMemo } from "solid-js";
import type { Channel } from "../../../lib/api";
import { channelDisplayName, channelIconName } from "../../../lib/displayName";
import { splitDragProps } from "../../../lib/dragSplitTarget";
import { store } from "../../../lib/store";
import { unreadSummary } from "../../../lib/unreadSummary";
import ChannelActionsMenuItems from "../../channel/ChannelActionsMenuItems";
import { channelHasDraft } from "../../composer/lib/drafts";
import { openConversationInSplit, SplitNavigation } from "../../navigation/SplitNavigation";

export default function ChannelRow(props: { channel: Channel; unread: boolean }) {
  const ctxMenu = useContextMenu();
  const isActive = createMemo(() => {
    const v = store.viewState.activeView();
    return store.viewState.nav() === "home" && v?.kind === "channel" && v.id === props.channel.id;
  });
  const muted = createMemo(() => store.preferences.isChannelMuted(props.channel.id));
  const hasDraft = createMemo(() => channelHasDraft(props.channel.id));
  const unreadTooltip = createMemo(() =>
    unreadSummary({
      currentUserId: store.users.currentUser()?.id,
      lastRead: store.unread.lastReadByChannel[props.channel.id],
      loadedMessages: store.messages.messagesByChannel[props.channel.id],
      mentions: props.channel.mentions,
    }),
  );

  return (
    <>
      <SplitNavigation onSplit={() => openConversationInSplit(props.channel.id)}>
        <button
          class="sidebar-row btn-reset flex-align-center"
          classList={{
            active: isActive(),
            muted: muted(),
            unread: props.unread && !muted(),
          }}
          data-channel-id={props.channel.id}
          data-nav-row
          onClick={() => store.viewState.setActiveView({ id: props.channel.id, kind: "channel" })}
          onContextMenu={ctxMenu.open}
          tabIndex={-1}
          type="button"
          {...splitDragProps({ channelId: props.channel.id })}
        >
          <span class="sidebar-row-icon">
            <Icon name={channelIconName(props.channel.private)} size={13} />
          </span>
          <span class="sidebar-row-name truncate">{channelDisplayName(props.channel)}</span>
          <span class="sidebar-row-end">
            {hasDraft() ? (
              <span class="sidebar-row-draft" title="draft">
                <Icon name="edit" size={12} />
              </span>
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
