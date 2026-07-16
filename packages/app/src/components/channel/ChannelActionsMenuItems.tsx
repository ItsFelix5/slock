import { Icon } from "@slock/ui";
import { createMemo, onMount, Show } from "solid-js";
import { openChannelDetails } from "../../lib/channelDetails";
import { store } from "../../lib/store";

export interface ChannelActionsMenuItemsProps {
  channelId: string;
  channelTitle: string;
  isDm?: boolean;
  onClose: () => void;
}

// The channel header's "..." menu contents — shared with a channel row's
// right-click ContextMenu in the sidebar, so both stay in sync for free.
export default function ChannelActionsMenuItems(props: ChannelActionsMenuItemsProps) {
  const muted = createMemo(() => store.preferences.isChannelMuted(props.channelId));
  const notifyAll = createMemo(() => store.preferences.isChannelNotifyAll(props.channelId));
  const canvas = createMemo(() => store.canvas.canvasByChannel[props.channelId]);

  onMount(() => {
    if (!props.isDm) store.canvas.ensureCanvasChecked(props.channelId);
  });

  const run = (fn: () => void) => {
    props.onClose();
    fn();
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
        onClick={() => run(() => store.preferences.toggleMuteChannel(props.channelId))}
        type="button"
      >
        <Icon name={muted() ? "notifications" : "notifications-off"} size={15} />
        {muted() ? "Unmute channel" : "Mute channel"}
      </button>
      <button
        class="menu-item"
        onClick={() => run(() => store.preferences.toggleNotifyAllChannel(props.channelId))}
        type="button"
      >
        <Icon
          name={notifyAll() ? "notifications-just-mentions" : "notifications-all-new-posts"}
          size={15}
        />
        {notifyAll() ? "Only notify me about mentions" : "Notify me about all new messages"}
      </button>
      <Show when={!props.isDm && canvas()}>
        <button
          class="menu-item"
          onClick={() => run(() => store.canvas.openChannelCanvas(props.channelId))}
          type="button"
        >
          <Icon name="canvas-filled" size={15} />
          View canvas
        </button>
      </Show>
      <button
        class="menu-item"
        onClick={() =>
          run(() => navigator.clipboard.writeText(`${location.origin}/#${props.channelId}`))
        }
        type="button"
      >
        <Icon name="link" size={15} />
        {props.isDm ? "Copy link to conversation" : "Copy link to channel"}
      </button>
      <Show when={!props.isDm}>
        <button
          class="menu-item danger"
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
