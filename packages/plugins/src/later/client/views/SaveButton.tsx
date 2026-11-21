import { service } from "@slock/core/solid";
import type { MessageBarProps } from "@slock/plugins/messages/client/api";
import { IconButton } from "@slock/ui";

export default function SaveButton(props: MessageBarProps) {
  const later = service("later");
  const saved = () => later.isSavedForLater(props.channelId, props.msg.ts);
  return (
    <IconButton
      active={saved()}
      class="message-hover-btn icon-shift busy hover-hl"
      disabled={later.laterLoading() || later.isSaveForLaterPending(props.channelId, props.msg.ts)}
      icon={saved() ? "bookmark-filled" : "bookmark"}
      iconSize={15}
      label={saved() ? "Remove from Later" : "Save for later"}
      onClick={() => later.toggleSaveForLater(props.channelId, props.msg.ts)}
      tabindex={props.rowFocused() ? undefined : -1}
    />
  );
}
