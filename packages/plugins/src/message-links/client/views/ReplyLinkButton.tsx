import type { MessageBarProps } from "@slock/plugins/messages/client/api";
import { IconButton } from "@slock/ui";
import { Show } from "solid-js";

export default function ReplyLinkButton(props: MessageBarProps) {
  return (
    <Show when={props.onReplyLink}>
      <IconButton
        class="message-hover-btn icon-shift busy hover-hl"
        icon="email-reply"
        label="Reply"
        onClick={() => props.onReplyLink?.(props.msg)}
        tabindex={props.rowFocused() ? undefined : -1}
      />
    </Show>
  );
}
