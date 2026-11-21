import { service } from "@slock/core/solid";
import type { MessageMenuProps } from "@slock/plugins/messages/client/api";
import { MenuItem } from "@slock/ui";
import { Show } from "solid-js";

export default function BroadcastItem(props: MessageMenuProps) {
  const messages = service("messages");
  const canBroadcast = () =>
    !!props.threadTs &&
    props.threadTs !== props.msg.ts &&
    !props.msg.isBroadcast &&
    messages.isMine(props.msg);
  return (
    <Show when={canBroadcast()}>
      <MenuItem
        icon="channel"
        onClick={() => {
          props.close();
          messages.broadcastThreadReply(props.channelId, props.msg.ts);
        }}
      >
        Also send to channel
      </MenuItem>
    </Show>
  );
}
