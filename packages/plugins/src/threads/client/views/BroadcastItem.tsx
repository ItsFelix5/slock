import { service } from "@slock/core/solid";
import { MenuItem } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageMenuProps } from "../../../messages/client/api";

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
