import { Slot } from "@slock/core/solid";
import type { Message } from "@slock/types";

export interface MessageActionsMenuItemsProps {
  channelId: string;
  msg: Message;
  onClose: () => void;
  onEditRequest: () => void;
  threadTs?: string;
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
