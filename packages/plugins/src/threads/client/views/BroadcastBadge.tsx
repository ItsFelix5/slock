import { Icon } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageBadgeProps } from "../../../messages/client/api";

export default function BroadcastBadge(props: MessageBadgeProps) {
  return (
    <Show when={props.showBroadcast}>
      <span class="message-broadcast-badge">
        <Icon name="channel" size={11} />
        Also sent to channel
      </span>
    </Show>
  );
}
