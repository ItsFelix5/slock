import { Slot } from "@slock/core/solid";
import type { ChannelId, Message, Ts } from "@slock/types";

interface MessageActionsMenuItemsProps {
  channelId: ChannelId;
  msg: Message;
  onClose: () => void;
  onEditRequest: () => void;
  threadTs?: Ts;
}

export default function MessageActionsMenuItems(props: MessageActionsMenuItemsProps) {
  return (
    <Slot
      channelId={props.channelId}
      close={props.onClose}
      edit={props.onEditRequest}
      msg={props.msg}
      point="messages.menu"
      threadTs={props.threadTs}
    />
  );
}
