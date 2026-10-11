import { service } from "@slock/core/solid";
import { Icon, Menu, MenuItem } from "@slock/ui";
import { createSignal } from "solid-js";
import type { ChannelMenuProps } from "../../../messages/client/api";
import "./NotificationsMenu.css";

export default function NotificationsMenu(props: ChannelMenuProps) {
  const prefs = service("prefs");
  const [open, setOpen] = createSignal(false);
  const muted = () => prefs.isChannelMuted(props.channelId);
  const notifyAll = () => prefs.isChannelNotifyAll(props.channelId);
  const icon = () =>
    muted()
      ? "notifications-off"
      : notifyAll()
        ? "notifications-all-new-posts"
        : "notifications-just-mentions";
  const run = (action: () => void) => {
    props.close();
    action();
  };

  return (
    <Menu
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      open={open()}
      openOnHover
      panelClass="menu-panel channel-notifications-submenu"
      placement="right"
      trigger={
        <MenuItem icon={icon()} onClick={() => setOpen(!open())}>
          Notifications
          <Icon class="menu-item-caret" name="caret-right" size={13} />
        </MenuItem>
      }
    >
      <MenuItem
        disabled={prefs.isMutePending(props.channelId)}
        icon={muted() ? "notifications" : "notifications-off"}
        onClick={() => run(() => prefs.toggleMuteChannel(props.channelId))}
      >
        {muted() ? "Unmute channel" : "Mute channel"}
      </MenuItem>
      <MenuItem
        disabled={prefs.isNotifyAllPending(props.channelId)}
        icon={notifyAll() ? "notifications-just-mentions" : "notifications-all-new-posts"}
        onClick={() => run(() => prefs.toggleNotifyAllChannel(props.channelId))}
      >
        {notifyAll() ? "Only notify me about mentions" : "Notify me about all new messages"}
      </MenuItem>
    </Menu>
  );
}
