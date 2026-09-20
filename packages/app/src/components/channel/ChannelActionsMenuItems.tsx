import { confirmDialog, debugMode, Icon, Menu, MenuItem, showDebugInfo } from "@slock/ui";
import { createSignal, Show } from "solid-js";
import { actionFeedback } from "../../lib/feedback";
import { store } from "../../lib/store";
import "./ChannelActionsMenuItems.css";
import ChannelMoveMenu from "./ChannelMoveMenu";
import { openChannelDetails } from "./lib/channelDetails";

export interface ChannelActionsMenuItemsProps {
  channelId: string;
  channelTitle: string;
  isDm?: boolean;
  onClose: () => void;
  showMoveTo?: boolean;
}

export default function ChannelActionsMenuItems(props: ChannelActionsMenuItemsProps) {
  const [notifOpen, setNotifOpen] = createSignal(false);
  const muted = () => store.preferences.isChannelMuted(props.channelId);
  const notifyAll = () => store.preferences.isChannelNotifyAll(props.channelId);
  const notifIcon = () =>
    muted()
      ? "notifications-off"
      : notifyAll()
        ? "notifications-all-new-posts"
        : "notifications-just-mentions";

  const run = (fn: () => void) => {
    props.onClose();
    fn();
  };

  const copyConversationLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/#${props.channelId}`);
    } catch {
      actionFeedback.flash(props.channelId, "Couldn't copy the link.", "error");
    }
  };

  const showDebug = () => {
    const data = props.isDm
      ? store.dms.dmById(props.channelId)
      : store.channels.channelById(props.channelId);
    showDebugInfo(`${props.isDm ? "DM" : "Channel"} ${props.channelId}`, data);
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
      <Menu
        onClose={() => setNotifOpen(false)}
        onOpen={() => setNotifOpen(true)}
        open={notifOpen()}
        openOnHover
        panelClass="menu-panel channel-notifications-submenu"
        placement="right"
        trigger={
          <MenuItem icon={notifIcon()} onClick={() => setNotifOpen(!notifOpen())}>
            Notifications
            <Icon class="menu-item-caret" name="caret-right" size={13} />
          </MenuItem>
        }
      >
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
      </Menu>
      <MenuItem icon="link" onClick={() => run(copyConversationLink)}>
        {props.isDm ? "Copy link to conversation" : "Copy link to channel"}
      </MenuItem>
      <Show when={!props.isDm}>
        <MenuItem
          danger
          disabled={store.channels.isLeavePending(props.channelId)}
          icon="sign-out"
          onClick={async () => {
            props.onClose();

            const ok = await confirmDialog({
              confirmLabel: "Leave",
              danger: true,
              message: `Leave #${props.channelTitle}?`,
            });
            if (ok) store.channels.leaveCurrentChannel(props.channelId);
          }}
        >
          Leave channel
        </MenuItem>
      </Show>
      <Show when={debugMode()}>
        <MenuItem icon="bug" onClick={() => run(showDebug)}>
          Show debug info
        </MenuItem>
      </Show>
    </>
  );
}
