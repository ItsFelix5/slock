import { MenuItem } from "@slock/ui";
import type { ChannelMenuProps } from "../../../messages/client/api";
import { copyChannelLink } from "../api/messageLinks";

export default function CopyChannelLinkItem(props: ChannelMenuProps) {
  return (
    <MenuItem
      icon="link"
      onClick={() => {
        props.close();
        copyChannelLink(props.channelId);
      }}
    >
      {props.isDm ? "Copy link to conversation" : "Copy link to channel"}
    </MenuItem>
  );
}
