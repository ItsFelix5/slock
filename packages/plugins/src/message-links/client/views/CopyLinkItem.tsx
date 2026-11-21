import type { MessageMenuProps } from "@slock/plugins/messages/client/api";
import { MenuItem } from "@slock/ui";
import { copyMessageLink } from "../api/messageLinks";

export default function CopyLinkItem(props: MessageMenuProps) {
  return (
    <MenuItem
      icon="link"
      onClick={() => {
        props.close();
        copyMessageLink(props.channelId, props.msg.ts, props.threadTs);
      }}
    >
      Copy link
    </MenuItem>
  );
}
