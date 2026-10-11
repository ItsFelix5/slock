import { service } from "@slock/core/solid";
import { Icon } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageBadgeProps } from "../../../messages/client/api";

export default function SavedBadge(props: MessageBadgeProps) {
  const later = service("later");
  return (
    <Show when={later.isSavedForLater(props.channelId, props.message.ts)}>
      <span class="message-saved-badge">
        <Icon name="bookmark-filled" size={11} />
        Saved
      </span>
    </Show>
  );
}
