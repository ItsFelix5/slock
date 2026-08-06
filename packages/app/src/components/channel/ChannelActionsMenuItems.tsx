import { Icon } from "@slock/ui";
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
      <button
        class="menu-item"
        onClick={() => run(() => store.messages.markCurrentChannelRead(props.channelId))}
        type="button"
      >
        <Icon name="mark-as-read" size={15} />
        Mark as read
      </button>
      <Show when={!props.isDm}>
        <button
          class="menu-item"
          onClick={() => run(() => openChannelDetails(props.channelId))}
          type="button"
        >
          <Icon name="channel-section" size={15} />
          Open channel details
        </button>
      </Show>
      <Show when={!props.isDm && props.showMoveTo}>
        <ChannelMoveMenu
          channelId={props.channelId}
          channelTitle={props.channelTitle}
          onComplete={props.onClose}
          variant="menu-item"
        />
      </Show>
      <button
        class="menu-item"
        onClick={() => run(() => store.pinned.openPinnedPanel(props.channelId))}
        type="button"
      >
        <Icon name="pin" size={15} />
        View pinned items
      </button>
      <button
        class="menu-item"
        disabled={store.preferences.isMutePending(props.channelId)}
        onClick={() => run(() => store.preferences.toggleMuteChannel(props.channelId))}
        type="button"
      >
        <Icon name={muted() ? "notifications" : "notifications-off"} size={15} />
        {muted() ? "Unmute channel" : "Mute channel"}
      </button>
      <button
        class="menu-item"
        disabled={store.preferences.isNotifyAllPending(props.channelId)}
        onClick={() => run(() => store.preferences.toggleNotifyAllChannel(props.channelId))}
        type="button"
      >
        <Icon
          name={notifyAll() ? "notifications-just-mentions" : "notifications-all-new-posts"}
          size={15}
        />
        {notifyAll() ? "Only notify me about mentions" : "Notify me about all new messages"}
      </button>
      <button class="menu-item" onClick={() => run(copyConversationLink)} type="button">
        <Icon name="link" size={15} />
        {props.isDm ? "Copy link to conversation" : "Copy link to channel"}
      </button>
      <Show when={!props.isDm}>
        <button
          class="menu-item danger"
          disabled={store.channels.isLeavePending(props.channelId)}
          onClick={() => {
            props.onClose();
            // biome-ignore lint/suspicious/noAlert: Leaving a channel requires explicit confirmation.
            if (confirm(`Leave #${props.channelTitle}?`))
              store.channels.leaveCurrentChannel(props.channelId);
          }}
          type="button"
        >
          <Icon name="sign-out" size={15} />
          Leave channel
        </button>
      </Show>
    </>
  );
}
