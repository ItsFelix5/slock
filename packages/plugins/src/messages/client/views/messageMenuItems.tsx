import { service } from "@slock/core/solid";
import { MenuItem } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageMenuProps } from "../api";
import { copyMessageText, deleteOrDismissMessage } from "../messageActions";

export function EditItem(props: MessageMenuProps) {
  return (
    <Show when={service("messages").isMine(props.msg)}>
      <MenuItem
        icon="edit"
        onClick={() => {
          props.close();
          props.edit();
        }}
      >
        Edit message
      </MenuItem>
    </Show>
  );
}

export function MarkUnreadItem(props: MessageMenuProps) {
  const messages = service("messages");
  return (
    <MenuItem
      icon="mark-as-unread"
      onClick={() => {
        props.close();
        messages.toggleMessageUnread(props.channelId, props.msg.ts, props.threadTs);
      }}
    >
      {messages.isMessageUnread(props.channelId, props.msg.ts, props.threadTs)
        ? "Mark read"
        : "Mark unread"}
    </MenuItem>
  );
}

export function CopyTextItem(props: MessageMenuProps) {
  return (
    <MenuItem
      icon="text"
      onClick={() => {
        props.close();
        copyMessageText(props.msg);
      }}
    >
      Copy text
    </MenuItem>
  );
}

export function DeleteItem(props: MessageMenuProps) {
  return (
    <Show when={props.msg.deleted || service("messages").isMine(props.msg)}>
      <MenuItem
        danger
        icon="trash"
        onClick={() => {
          props.close();
          deleteOrDismissMessage(props.channelId, props.msg);
        }}
      >
        Delete message
      </MenuItem>
    </Show>
  );
}
