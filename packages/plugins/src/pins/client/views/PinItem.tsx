import { service } from "@slock/core/solid";
import { MenuItem } from "@slock/ui";
import type { MessageMenuProps } from "../../../messages/client/api";

export default function PinItem(props: MessageMenuProps) {
  const pins = service("pins");
  return (
    <MenuItem
      disabled={pins.isPinPending(props.channelId, props.msg.ts)}
      icon="pin"
      onClick={() => {
        props.close();
        pins.togglePinMessage(props.channelId, props.msg.ts);
      }}
    >
      {pins.isMessagePinned(props.channelId, props.msg.ts)
        ? "Unpin from channel"
        : "Pin to channel"}
    </MenuItem>
  );
}
