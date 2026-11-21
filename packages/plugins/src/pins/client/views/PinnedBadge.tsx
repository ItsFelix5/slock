import { service } from "@slock/core/solid";
import type { MessageBadgeProps } from "@slock/plugins/messages/client/api";
import { Icon } from "@slock/ui";
import { Show } from "solid-js";

export default function PinnedBadge(props: MessageBadgeProps) {
  const pins = service("pins");
  return (
    <Show when={pins.isMessagePinned(props.channelId, props.message.ts)}>
      <span class="message-pinned-badge">
        <Icon name="pin-filled" size={11} />
        Pinned
      </span>
    </Show>
  );
}
