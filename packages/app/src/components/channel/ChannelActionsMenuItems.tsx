import { Icon } from "@slock/ui";
import { createMemo, onMount, Show } from "solid-js";
import { openChannelDetails } from "../../lib/channelDetails";
import {
  canvasByChannel,
  createCanvasForCurrentChannel,
  ensureCanvasChecked,
  isChannelMuted,
  isChannelNotifyAll,
  leaveCurrentChannel,
  markCurrentChannelRead,
  openPinnedPanel,
  toggleMuteChannel,
  toggleNotifyAllChannel,
} from "../../lib/store";

export interface ChannelActionsMenuItemsProps {
  channelId: string;
  channelTitle: string;
  isDm?: boolean;
  onClose: () => void;
}

// The channel header's "..." menu contents — shared with a channel row's
// right-click ContextMenu in the sidebar, so both stay in sync for free.
export default function ChannelActionsMenuItems(props: ChannelActionsMenuItemsProps) {
  const muted = createMemo(() => isChannelMuted(props.channelId));
  const notifyAll = createMemo(() => isChannelNotifyAll(props.channelId));
  const canvas = createMemo(() => canvasByChannel[props.channelId]);

  onMount(() => {
    if (!props.isDm) ensureCanvasChecked(props.channelId);
  });

  const run = (fn: () => void) => {
    props.onClose();
    fn();
  };

  return (
    <>
      <button
        type="button"
        class="menu-item"
        onClick={() => run(() => markCurrentChannelRead(props.channelId))}
      >
        <Icon name="mark-as-read" size={15} />
        Mark as read
      </button>
      <Show when={!props.isDm}>
        <button
          type="button"
          class="menu-item"
          onClick={() => run(() => openChannelDetails(props.channelId))}
        >
          <Icon name="channel-section" size={15} />
          Open channel details
        </button>
      </Show>
      <button
        type="button"
        class="menu-item"
        onClick={() => run(() => openPinnedPanel(props.channelId))}
      >
        <Icon name="pin" size={15} />
        View pinned items
      </button>
      <button
        type="button"
        class="menu-item"
        onClick={() => run(() => toggleMuteChannel(props.channelId))}
      >
        <Icon name={muted() ? "notifications" : "notifications-off"} size={15} />
        {muted() ? "Unmute channel" : "Mute channel"}
      </button>
      <button
        type="button"
        class="menu-item"
        onClick={() => run(() => toggleNotifyAllChannel(props.channelId))}
      >
        <Icon
          name={notifyAll() ? "notifications-just-mentions" : "notifications-all-new-posts"}
          size={15}
        />
        {notifyAll() ? "Only notify me about mentions" : "Notify me about all new messages"}
      </button>
      <Show when={!props.isDm && !canvas()}>
        <button
          type="button"
          class="menu-item"
          onClick={() => run(() => createCanvasForCurrentChannel(props.channelId))}
        >
          <Icon name="add-channel-canvas" size={15} />
          Create canvas
        </button>
      </Show>
      <button
        type="button"
        class="menu-item"
        onClick={() =>
          run(() => navigator.clipboard.writeText(`${location.origin}/#${props.channelId}`))
        }
      >
        <Icon name="link" size={15} />
        {props.isDm ? "Copy link to conversation" : "Copy link to channel"}
      </button>
      <Show when={!props.isDm}>
        <button
          type="button"
          class="menu-item danger"
          onClick={() => {
            props.onClose();
            if (confirm(`Leave #${props.channelTitle}?`)) leaveCurrentChannel(props.channelId);
          }}
        >
          <Icon name="sign-out" size={15} />
          Leave channel
        </button>
      </Show>
    </>
  );
}
