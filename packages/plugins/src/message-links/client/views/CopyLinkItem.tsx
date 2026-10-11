import { MenuItem } from "@slock/ui";
import type { MessageMenuProps } from "../../../messages/client/api";
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
