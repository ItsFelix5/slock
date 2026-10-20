import { Mrkdwn } from "@slock/blockkit";
import type { Message } from "@slock/types";
import { Icon } from "@slock/ui";
import { systemMessageIcon } from "../../lib/systemMessageIcon";

export default function SystemMessageContent(props: { msg: Message }) {
  return (
    <>
      <div class="message-system-icon flex-center">
        <Icon name={systemMessageIcon(props.msg.subtype)} size={16} />
      </div>
      <div class="message-body message-system-body">
        <span class="message-text">
          <Mrkdwn text={props.msg.text} />
        </span>
        <span class="message-time meta-dim">{props.msg.time}</span>
      </div>
    </>
  );
}
