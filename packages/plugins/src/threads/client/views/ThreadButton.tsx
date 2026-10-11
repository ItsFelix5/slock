import { IconButton } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageBarProps } from "../../../messages/client/api";

export default function ThreadButton(props: MessageBarProps) {
  const rootTs = () =>
    props.msg.isBroadcast && props.msg.threadTs ? props.msg.threadTs : props.msg.ts;
  return (
    <Show when={props.onOpenThread}>
      <IconButton
        class="message-hover-btn icon-shift busy hover-hl"
        icon="threads"
        label="Reply in thread"
        onClick={(e) => props.onOpenThread?.(rootTs(), { pinned: e.shiftKey })}
        tabIndex={props.rowFocused() ? undefined : -1}
      />
    </Show>
  );
}
