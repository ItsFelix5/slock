import { service } from "@slock/core/solid";
import { confirmDialog, MenuItem } from "@slock/ui";
import { Show } from "solid-js";
import type { ChannelMenuProps } from "../../../messages/client/api";

export default function LeaveItem(props: ChannelMenuProps) {
  const channels = service("channels");
  return (
    <Show when={!props.isDm}>
      <MenuItem
        danger
        disabled={channels.isLeavePending(props.channelId)}
        icon="sign-out"
        onClick={async () => {
          props.close();
          const ok = await confirmDialog({
            confirmLabel: "Leave",
            danger: true,
            message: `Leave #${props.channelTitle}?`,
          });
          if (ok) channels.leaveCurrentChannel(props.channelId);
        }}
      >
        Leave channel
      </MenuItem>
    </Show>
  );
}
