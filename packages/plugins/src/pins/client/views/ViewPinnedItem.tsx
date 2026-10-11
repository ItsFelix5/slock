import { service } from "@slock/core/solid";
import { MenuItem } from "@slock/ui";
import type { ChannelMenuProps } from "../../../messages/client/api";

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
