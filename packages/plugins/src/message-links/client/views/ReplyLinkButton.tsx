import { IconButton } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageBarProps } from "../../../messages/client/api";

export default function ReplyLinkButton(props: MessageBarProps) {
  return (
    <Show when={props.onReplyLink}>
      <IconButton
        class="message-hover-btn icon-shift busy hover-hl"
        icon="email-reply"
        label="Reply"
        onClick={() => props.onReplyLink?.(props.msg)}
        tabIndex={props.rowFocused() ? undefined : -1}
      />
    </Show>
  );
}
