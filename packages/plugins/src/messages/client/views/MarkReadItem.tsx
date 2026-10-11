import { service } from "@slock/core/solid";
import { MenuItem } from "@slock/ui";
import type { ChannelMenuProps } from "../api";

export default function MarkReadItem(props: ChannelMenuProps) {
  const messages = service("messages");
  return (
    <MenuItem
      icon="mark-as-read"
      onClick={() => {
        props.close();
        messages.markCurrentChannelRead(props.channelId);
      }}
    >
      Mark as read
    </MenuItem>
  );
}
