import { service } from "@slock/core/solid";
import { IconButton } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageBarProps } from "../api";

export default function EditButton(props: MessageBarProps) {
  return (
    <Show when={service("messages").isMine(props.msg)}>
      <IconButton
        class="message-hover-btn icon-shift busy hover-hl"
        icon="edit"
        label="Edit message"
        onClick={props.onEditRequest}
        tabIndex={props.rowFocused() ? undefined : -1}
      />
    </Show>
  );
}
