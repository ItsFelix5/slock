import { service } from "@slock/core/solid";
import { Icon } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageBadgeProps } from "../../../messages/client/api";

const messageLinks = service("message-links");

export default function BroadcastBadge(props: MessageBadgeProps) {
  return (
    <Show when={props.showBroadcast}>
      <button
        class="message-broadcast-badge btn-reset"
        onClick={() => messageLinks.openChannelMessage(props.channelId, props.message.ts)}
        type="button"
      >
        <Icon name="channel" size={11} />
        Also sent to channel
      </button>
    </Show>
  );
}
