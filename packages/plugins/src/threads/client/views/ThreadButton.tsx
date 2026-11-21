import type { MessageBarProps } from "@slock/plugins/messages/client/api";
import { threadRootTs } from "@slock/plugins/messages/client/api/messageFocus";
import { IconButton } from "@slock/ui";
import { Show } from "solid-js";

export default function ThreadButton(props: MessageBarProps) {
  return (
    <Show when={props.onOpenThread}>
      <IconButton
        class="message-hover-btn icon-shift busy hover-hl"
        icon="threads"
        label="Reply in thread"
        onClick={(e) => props.onOpenThread?.(threadRootTs(props.msg), { pinned: e.shiftKey })}
        tabindex={props.rowFocused() ? undefined : -1}
      />
    </Show>
  );
}
