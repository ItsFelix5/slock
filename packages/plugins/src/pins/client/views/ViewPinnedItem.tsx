import { service } from "@slock/core/solid";
import type { ChannelMenuProps } from "@slock/plugins/messages/client/api";
import { MenuItem } from "@slock/ui";

export default function ViewPinnedItem(props: ChannelMenuProps) {
  const pins = service("pins");
  return (
    <MenuItem
      icon="pin"
      onClick={() => {
        props.close();
        pins.openPinnedPane(props.channelId);
      }}
    >
      View pinned items
    </MenuItem>
  );
}
