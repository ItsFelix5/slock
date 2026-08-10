import { MenuItem } from "@slock/ui";
import { createMemo, Show } from "solid-js";
import { openChannelDetails } from "../../lib/channelDetails";
import { actionFeedback, store } from "../../lib/store";
import ChannelMoveMenu from "./ChannelMoveMenu";

export interface ChannelActionsMenuItemsProps {
  channelId: string;
  channelTitle: string;
  isDm?: boolean;
  onClose: () => void;
  showMoveTo?: boolean;
}

// The channel header's "..." menu contents — shared with a channel row's
// right-click ContextMenu in the sidebar, so both stay in sync for free.
export default function ChannelActionsMenuItems(props: ChannelActionsMenuItemsProps) {
  const muted = createMemo(() => store.preferences.isChannelMuted(props.channelId));
  const notifyAll = createMemo(() => store.preferences.isChannelNotifyAll(props.channelId));

  const run = (fn: () => void) => {
    props.onClose();
    fn();
  };

  const copyConversationLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/#${props.channelId}`);
    } catch {
      actionFeedback.flash(props.channelId, "Couldn’t copy the link.", "error");
    }
  };

  return (
    <>
      <MenuItem
        icon="mark-as-read"
        onClick={() => run(() => store.messages.markCurrentChannelRead(props.channelId))}
      >
        Mark as read
      </MenuItem>
      <Show when={!props.isDm}>
        <MenuItem
          icon="channel-section"
          onClick={() => run(() => openChannelDetails(props.channelId))}
        >
          Open channel details
        </MenuItem>
      </Show>
      <Show when={!props.isDm && props.showMoveTo}>
        <ChannelMoveMenu
          channelId={props.channelId}
          channelTitle={props.channelTitle}
          onComplete={props.onClose}
          variant="menu-item"
        />
      </Show>
      <MenuItem icon="pin" onClick={() => run(() => store.pinned.openPinnedPanel(props.channelId))}>
        View pinned items
      </MenuItem>
      <MenuItem
        disabled={store.preferences.isMutePending(props.channelId)}
        icon={muted() ? "notifications" : "notifications-off"}
        onClick={() => run(() => store.preferences.toggleMuteChannel(props.channelId))}
      >
        {muted() ? "Unmute channel" : "Mute channel"}
      </MenuItem>
      <MenuItem
        disabled={store.preferences.isNotifyAllPending(props.channelId)}
        icon={notifyAll() ? "notifications-just-mentions" : "notifications-all-new-posts"}
        onClick={() => run(() => store.preferences.toggleNotifyAllChannel(props.channelId))}
      >
        {notifyAll() ? "Only notify me about mentions" : "Notify me about all new messages"}
      </MenuItem>
      <MenuItem icon="link" onClick={() => run(copyConversationLink)}>
        {props.isDm ? "Copy link to conversation" : "Copy link to channel"}
      </MenuItem>
      <Show when={!props.isDm}>
        <MenuItem
          danger
          disabled={store.channels.isLeavePending(props.channelId)}
          icon="sign-out"
          onClick={() => {
            props.onClose();
            // biome-ignore lint/suspicious/noAlert: Leaving a channel requires explicit confirmation.
            if (confirm(`Leave #${props.channelTitle}?`))
              store.channels.leaveCurrentChannel(props.channelId);
          }}
        >
          Leave channel
        </MenuItem>
      </Show>
    </>
  );
}
