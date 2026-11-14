import { IconButton } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageBarProps } from "../../../messages/client/api";
import { threadRootTs } from "../../../messages/client/api/messageFocus";

export default function ThreadButton(props: MessageBarProps) {
  return (
    <Show when={props.onOpenThread}>
      <IconButton
        class="message-hover-btn icon-shift busy hover-hl"
        icon="threads"
        label="Reply in thread"
        onClick={(e) => props.onOpenThread?.(threadRootTs(props.msg), { pinned: e.shiftKey })}
        tabIndex={props.rowFocused() ? undefined : -1}
      />
    </Show>
  );
}
